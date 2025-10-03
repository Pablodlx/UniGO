import Link from "next/link";

export default function Home() {
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
      <div style={{ display: "flex", gap: "1rem" }}>
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
      </div>
    </main>
  );
}
