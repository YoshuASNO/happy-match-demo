
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useRequireAuth(authChecked: boolean) {
  const router = useRouter();

  useEffect(() => {
    if (!authChecked) return; // 判定が終わるまで何もしない
    if (typeof window !== "undefined") {
      const user = sessionStorage.getItem("user");
      if (!user) {
        router.replace("/login"); // ログインページにリダイレクト
      }
    }
  }, [authChecked, router]);
}
