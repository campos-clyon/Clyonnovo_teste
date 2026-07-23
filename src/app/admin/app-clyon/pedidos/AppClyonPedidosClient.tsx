"use client";

import AppClyonShell from "../AppClyonShell";
import AppPedidosClient from "@/app/admin/app-pedidos/AppPedidosClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";

export default function AppClyonPedidosClient() {
  const { authHeader, ready } = useAdminAuth({ skip: false });

  return (
    <AppClyonShell>
      {ready && (
        <AppPedidosClient externalAuthHeader={authHeader} />
      )}
    </AppClyonShell>
  );
}
