import AdminErrorBoundary from "@/components/admin/AdminErrorBoundary";
import type { Metadata } from "next";
import type { ReactNode } from "react";

/*
 * O backoffice inteiro é noindex — 29-09-2026.
 *
 * As páginas de dentro já o diziam uma a uma; o /admin/login não dizia nada
 * e herdava do layout do site «index, follow» e o canónico da homepage. O
 * robots.txt bloqueia /admin, mas o robots.txt pede, não impede: um link de
 * fora bastava para a entrada do backoffice aparecer no Google. Dito aqui,
 * vale para tudo o que está debaixo — as páginas que declaram o seu próprio
 * `robots` continuam a mandar no delas.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminErrorBoundary>{children}</AdminErrorBoundary>;
}
