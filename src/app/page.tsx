"use client";

import Image from "next/image";
import Header from "../components/Header";
import { supabase } from "../lib/supabaseClient";
import { useRequireAuth } from "../hooks/useRequireAuth";

import { useEffect, useState, useRef } from "react";

// VAPID公開鍵（後でAPI Routeから取得する形にしてもOK）
const VAPID_PUBLIC_KEY = "ここにVAPID公開鍵を入力";

export default function Home() {
  const [userName, setUserName] = useState<string>("");
  const [authChecked, setAuthChecked] = useState(false);
  const myLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  // Push通知購読処理
  useEffect(() => {
    if (typeof window === "undefined" || !('serviceWorker' in navigator)) return;
    // サービスワーカー登録
    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      // すでに購読済みなら何もしない
      const existing = await reg.pushManager.getSubscription();
      if (existing) return;
      // 通知許可
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      // Push購読
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      // Supabaseに購読情報を保存（API Route経由推奨、ここではconsole.log）
      console.log('Push Subscription:', JSON.stringify(sub));
      // TODO: Supabaseに保存する処理を追加
    });
    // VAPID鍵変換関数
    function urlBase64ToUint8Array(base64String: string) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }
  }, []);

  // Haversine距離計算関数
  function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371; // 地球半径(km)
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // 現在地取得
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        myLocationRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
      });
    }
  }, []);

  // Supabase Realtimeでmaydays監視
  useEffect(() => {
    const channel = supabase
      .channel('maydays-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'maydays',
      }, (payload) => {
        const { latitude, longitude } = payload.new;
        const myLoc = myLocationRef.current;
        if (myLoc) {
          const dist = getDistanceKm(myLoc.lat, myLoc.lng, latitude, longitude);
          if (dist <= 5) {
            alert(`5km以内のMayday発生！距離: ${dist.toFixed(2)}km`);
          }
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const fetchUserName = async () => {
      const { data: authUser, error: authError } = await supabase.auth.getUser();
      if (authUser?.user) {
        const uuid = authUser.user.id;
        // uuidでpublic.userテーブルからユーザー名取得
          const { data, error } = await supabase
            .from("users")
            .select("name")
            .eq("id", uuid)
            .maybeSingle();
          if (data && data.name) {
            setUserName(data.name);
          }
      }
      setAuthChecked(true);
    };
    fetchUserName();
  }, []);

  useRequireAuth(authChecked);

  // 認証判定が終わるまで何も表示しない
  if (!authChecked) {
    return null;
  }

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        {userName && (
          <>
            <div className="text-xl font-bold mb-8">ようこそ{userName}さん</div>
            <button
              className="bg-yellow-400 hover:bg-yellow-500 text-white font-bold py-6 px-10 rounded-full shadow-xl mb-8 text-2xl w-56 h-40 flex items-center justify-center"
              onClick={async () => {
                if (!navigator.geolocation) {
                  alert("GPSが利用できません");
                  return;
                }
                navigator.geolocation.getCurrentPosition(async (pos) => {
                  const lat = pos.coords.latitude;
                  const lng = pos.coords.longitude;
                  // Supabase Authからuuid取得
                  const { data: authUser } = await supabase.auth.getUser();
                  const uuid = authUser?.user?.id;
                  if (!uuid) {
                    alert("ユーザーIDが取得できません");
                    return;
                  }
                  // maydayテーブルにinsert
                  const { error } = await supabase
                    .from("maydays")
                    .insert({ users_id: uuid, latitude: lat, longitude: lng });
                  if (error) {
                    alert("送信に失敗しました: " + error.message);
                  } else {
                    alert("位置情報を送信しました！");
                  }
                }, (err) => {
                  alert("位置情報の取得に失敗しました: " + err.message);
                });
              }}
            >
              ピコーン！
            </button>
          </>
        )}
      </main>
    </div>
  );
}

