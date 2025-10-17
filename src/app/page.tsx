"use client";

import Image from "next/image";
import Header from "../components/Header";
import { supabase } from "../lib/supabaseClient";
import { useRequireAuth } from "../hooks/useRequireAuth";

import { useEffect, useState, useRef } from "react";

// VAPID公開鍵（後でAPI Routeから取得する形にしてもOK）
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

export default function Home() {
  const [userName, setUserName] = useState<string>("");
  const [authChecked, setAuthChecked] = useState(false);
  const myLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  // VAPID鍵のUint8Array変換
  function convertVapidKey(base64: string) {
    const pad = "=".repeat((4 - base64.length % 4) % 4);
    const base64Str = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(base64Str);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  }

  // Haversine距離計算関数
  function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371;
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

 // Push通知の購読とSupabaseへの登録
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.serviceWorker) return;

    async function subscribeAndRegister() {
      const reg = await navigator.serviceWorker.register("/sw.js");
      let subscription = await reg.pushManager.getSubscription();

      // 未購読なら新規購読
      if (!subscription) {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertVapidKey(VAPID_PUBLIC_KEY),
        });
      }

      // 認証ユーザーのID取得
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (userId && subscription) {
        // 既存購読でも必ずSupabaseに保存
        const { error } = await supabase
          .from("push_subscriptions")
          .upsert([{ user_id: userId, subscription }], { onConflict: 'user_id' });
        if (error) {
          alert("Push購読情報の保存に失敗しました: " + error.message);
        }
      }
    }

    subscribeAndRegister();
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
                    await sendPushToAll("Mayday!", "5km以内でMaydayが発生しました！");
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

// 全ユーザーにWeb Push通知を送信する関数
export async function sendPushToAll(title: string, body: string) {
  // push_subscriptionsテーブルから全購読情報を取得
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("subscription");

  if (error) {
    alert("購読情報の取得に失敗しました");
    return;
  }

  if (data) {
    for (const row of data) {
      await fetch("/api/send-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: row.subscription,
          title,
          body,
        }),
      });
    }
  }
}