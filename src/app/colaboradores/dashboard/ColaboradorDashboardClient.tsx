"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getColaboradorItem } from "@/lib/colaborador-storage";
import { Loader2 } from "lucide-react";

export default function ColaboradorDashboard() {
  const router = useRouter();

  useEffect(() => {
    const token = getColaboradorItem("token");
    if (!token) {
      router.push("/colaboradores");
      return;
    }
    router.push("/admin");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_24%),linear-gradient(180deg,#f8fcff_0%,#eef7fb_100%)]">
      <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
    </div>
  );
}
