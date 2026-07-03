"use client";

import { useAdminAuth } from "@/hooks/useAdminAuth";
import PagamentosPanel from "@/components/admin/PagamentosPanel";

export default function PagamentosClient() {
  const { ready, authHeader } = useAdminAuth();
  if (!ready) return null;
  return <PagamentosPanel authHeader={authHeader} />;
}
