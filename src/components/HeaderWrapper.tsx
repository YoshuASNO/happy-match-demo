"use client";
import Header from "@/components/Header";
import { usePathname } from "next/navigation";

export default function HeaderWrapper() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return <Header />;
}
