import AdminErrorBoundary from "@/components/admin/AdminErrorBoundary";
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminErrorBoundary>{children}</AdminErrorBoundary>;
}
