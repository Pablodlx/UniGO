"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_API_BASE;

// Helpers mínimos (si ya los tienes en src/lib/api.ts, puedes importarlos desde allí)
function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}
function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
}
async function getProfile() {
  const t = getToken();
  if (!t) throw new Error("UNAUTHORIZED");
  const r = await fetch(`${BASE}/me/profile`, {
    headers: { Authorization: `Bearer ${t}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}
function isProfileComplete(p: any): boolean {
  return Boolean(
    p &&
      p.full_name &&
      p.university &&
      p.degree &&
      typeof p.course === "number" &&
      p.course >= 1 &&
      p.ride_intent
  );
}

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      setLoggedIn(false);
      setChecking(false);
      return;
    }
    setLoggedIn(true);
    (async () => {
      try {
        const p = await getProfile();
        setProfileComplete(isProfileComplete(p));
      } catch {
        // si el token es inválido, lo tratamos como no logueado
        setLoggedIn(false);
        clearToken();
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "Arial, sans-serif",
        backgroundColor: "#f4f6f9",
      }}
    >
      <h1 style={{ fontSize: "2.5rem", marginBottom: "1rem", color: "#333" }}>
        Bienvenido a <span style={{ color: "#0070f3" }}>UniGO</span>
      </h1>
      <p style={{ fontSize: "1.2rem", marginBottom: "2rem", color: "#666" }}>
        Gestiona tu cuenta universitaria de manera rápida y segura.
      </p>

      {/* Banner si el perfil está incompleto */}
      {loggedIn && !checking && profileComplete === false && (
        <div
          style={{
            marginBottom: "1.25rem",
            padding: "0.75rem 1rem",
            borderRadius: 8,
            border: "1px solid #FACC15",
            background: "#FEF3C7",
            color: "#92400E",
            fontSize: 14,
            maxWidth: 560,
            textAlign: "center",
          }}
        >
          <b>Completa tu perfil</b> para poder publicar o solicitar viajes
          (nombre, universidad, carrera, curso y preferencia).
        </div>
      )}

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        {!loggedIn && (
          <>
            <Link href="/register">
              <button
                style={{
                  padding: "0.8rem 1.5rem",
                  fontSize: "1rem",
                  fontWeight: "bold",
                  backgroundColor: "#0070f3",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Registro
              </button>
            </Link>
            <Link href="/login">
              <button
                style={{
                  padding: "0.8rem 1.5rem",
                  fontSize: "1rem",
                  fontWeight: "bold",
                  backgroundColor: "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Login
              </button>
            </Link>
          </>
        )}

        {loggedIn && (
          <>
            {/* Mientras comprobamos el perfil */}
            {checking && (
              <button
                disabled
                style={{
                  padding: "0.8rem 1.5rem",
                  fontSize: "1rem",
                  fontWeight: "bold",
                  backgroundColor: "#9CA3AF",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                }}
              >
                Comprobando perfil…
              </button>
            )}

            {/* Acciones según estado del perfil */}
            {!checking && profileComplete === false && (
              <Link href="/profile?setup=1">
                <button
                  style={{
                    padding: "0.8rem 1.5rem",
                    fontSize: "1rem",
                    fontWeight: "bold",
                    backgroundColor: "#F59E0B",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  Completar perfil
                </button>
              </Link>
            )}

            {!checking && profileComplete === true && (
              <Link href="/profile">
                <button
                  style={{
                    padding: "0.8rem 1.5rem",
                    fontSize: "1rem",
                    fontWeight: "bold",
                    backgroundColor: "#2563EB",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  Editar perfil
                </button>
              </Link>
            )}

            {/* Logout opcional */}
            <button
              onClick={() => {
                clearToken();
                window.location.reload();
              }}
              style={{
                padding: "0.8rem 1.5rem",
                fontSize: "1rem",
                fontWeight: "bold",
                backgroundColor: "#EF4444",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </>
        )}
      </div>
    </main>
  );
}
