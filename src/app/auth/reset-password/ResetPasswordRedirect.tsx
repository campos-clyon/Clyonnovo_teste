"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function ResetPasswordRedirect() {
  const params = useSearchParams();

  useEffect(() => {
    const query = params.toString();
    window.location.href = `clyonprofissionais://reset-password${query ? `?${query}` : ""}`;
  }, [params]);

  function handleOpen() {
    const query = params.toString();
    window.location.href = `clyonprofissionais://reset-password${query ? `?${query}` : ""}`;
  }

  return (
    <div style={{
      textAlign: "center",
      padding: "80px 20px",
      fontFamily: "sans-serif",
      backgroundColor: "#0F172A",
      color: "#FFFFFF",
      minHeight: "100vh",
    }}>
      <h2 style={{ color: "#26C6DA" }}>A abrir o CLYON Pro...</h2>
      <p style={{ color: "#94A3B8", marginTop: "10px" }}>
        Se a aplicação não abrir automaticamente, verifique se tem a app instalada ou utilize o botão abaixo.
      </p>
      <button
        onClick={handleOpen}
        style={{
          marginTop: "20px",
          backgroundColor: "#26C6DA",
          color: "#0F172A",
          border: "none",
          padding: "12px 24px",
          borderRadius: "8px",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        Abrir Aplicação
      </button>
    </div>
  );
}
