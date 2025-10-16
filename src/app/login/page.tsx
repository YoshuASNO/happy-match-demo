"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  // /loginアクセス時にログイン中なら自動ログアウト
  useEffect(() => {
    if (typeof window !== "undefined") {
      const user = sessionStorage.getItem("user");
      if (user) {
        sessionStorage.removeItem("user");
      }
    }
  }, []);

  // ログイン処理（ログインID→メール変換）
  const handleSignIn = async () => {
    setMessage("");
    const email = `${loginId}@example.com`;
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("認証エラー: " + error.message);
      return;
    }
    if (!data.session) {
      setMessage("ログインIDまたはパスワードが正しくありません");
      return;
    }

    setMessage("ログイン成功！");
    if (typeof window !== "undefined") {
      sessionStorage.setItem("user", JSON.stringify(data.user));
      window.location.replace("/");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="lg:w-1/3 md:w-1/2 bg-white rounded-lg p-8 flex flex-col w-full max-w-md shadow-md">
        <h2 className="text-gray-900 text-lg mb-6 font-medium title-font text-center">ユーザー認証</h2>
        <div className="relative mb-4">
          <label htmlFor="loginId" className="leading-7 text-sm text-gray-600">ログインID</label>
          <input
            id="loginId"
            type="text"
            placeholder=""
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            className="w-full bg-white rounded border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
          />
        </div>
        <div className="relative mb-6">
          <label htmlFor="message" className="leading-7 text-sm text-gray-600">パスワード</label>
          <input
            type="password"
            placeholder=""
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white rounded border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
          />
        </div>
        <button onClick={handleSignIn} className="text-white bg-indigo-500 border-0 py-2 px-6 focus:outline-none hover:bg-indigo-600 rounded text-lg">ログイン</button>
        {message && <div className="text-red-500 mt-4 text-center">{message}</div>}
      </div>
    </div>
  );
}
