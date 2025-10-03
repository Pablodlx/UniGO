"use client";
import { useState } from "react";

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);

  const fetchProfile = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("http://localhost:8000/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setProfile(await res.json());
    }
  };

  return (
    <div>
      <h1>Perfil</h1>
      <button onClick={fetchProfile}>Ver perfil</button>
      {profile && <pre>{JSON.stringify(profile, null, 2)}</pre>}
    </div>
  );
}
