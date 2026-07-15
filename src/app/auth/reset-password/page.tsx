import { Suspense } from "react";
import ResetPasswordRedirect from "./ResetPasswordRedirect";

export const metadata = {
  title: "Redefinir palavra-passe — CLYON Pro",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{
        textAlign: "center",
        padding: "80px 20px",
        fontFamily: "sans-serif",
        backgroundColor: "#0F172A",
        color: "#FFFFFF",
        minHeight: "100vh",
      }}>
        <h2 style={{ color: "#26C6DA" }}>A carregar...</h2>
      </div>
    }>
      <ResetPasswordRedirect />
    </Suspense>
  );
}
