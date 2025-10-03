"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("http://localhost:8000/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      if (res.ok) {
        alert("Cuenta verificada con éxito ✅");
        router.push("/login");
      } else {
        const data = await res.text();
        setError(data || "Código inválido");
      }
    } catch (err) {
      setError("Error de conexión con el servidor");
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Verificar cuenta</h1>
      <p>Introduce el código que hemos enviado a <b>{email}</b></p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Código de verificación"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        /><br /><br />
        <button type="submit">Verificar</button>
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
