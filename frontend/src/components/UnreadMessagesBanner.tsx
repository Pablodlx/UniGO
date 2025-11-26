"use client";

import { useUnreadBanner } from "@/hooks/useUnreadBanner";
import { useRouter } from "next/navigation";
import { markChatAsRead, ChatUnreadInfo } from "@/lib/api";

export default function UnreadMessagesBanner({ token }: { token: string | null }) {
  // Si no hay token, no renderizar nada
  if (!token || token.trim() === "") {
    console.log("UnreadMessagesBanner - No token provided, not rendering.");
    return null;
  }

  const { summary, visible, dismiss, refresh } = useUnreadBanner(token);
  const router = useRouter();

  console.log("UnreadMessagesBanner render - visible:", visible, "summary:", summary);
  console.log("UnreadMessagesBanner - Details:", {
    visible,
    hasSummary: !!summary,
    totalUnread: summary?.total_unread,
    maxMessageId: summary?.max_message_id,
    chatsCount: summary?.chats.length
  });

  if (!visible || !summary || summary.total_unread === 0) {
    console.log("UnreadMessagesBanner - Not rendering:", { 
      visible, 
      hasSummary: !!summary, 
      totalUnread: summary?.total_unread,
      reason: !visible ? "not visible" : !summary ? "no summary" : "total_unread is 0"
    });
    return null;
  }

  console.log("UnreadMessagesBanner - ✅ Rendering banner with", summary.chats.length, "chat(s)");

  const chats = summary.chats;

  const handleOpenChat = async (chat: ChatUnreadInfo) => {
    try {
      // Si es chat grupal, navegar a my-rides (el usuario puede abrir el chat desde ahí)
      // Si es chat 1-to-1, navegar a la página de chat
      if (chat.is_group_chat) {
        // Para chats grupales, navegar a my-rides
        // El usuario puede abrir el chat grupal desde la página de viajes
        router.push("/my-rides");
      } else {
        // Para chats 1-to-1, marcar como leído y navegar
        await markChatAsRead(chat.chat_id);
        router.push(`/chat/${chat.chat_id}`);
      }
      refresh(); // Refresh summary
      dismiss(); // Dismiss the banner
    } catch (error) {
      console.error("Error opening chat:", error);
      // Still navigate even if marking as read fails
      if (chat.is_group_chat) {
        router.push("/my-rides");
      } else {
        router.push(`/chat/${chat.chat_id}`);
      }
      dismiss();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 9999,
        background: "white",
        border: "1px solid #ddd",
        padding: "15px",
        borderRadius: "10px",
        width: "320px",
        boxShadow: "0 4px 15px rgba(0,0,0,0.15)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>Mensajes sin leer</strong>
        <button
          onClick={dismiss}
          style={{
            background: "transparent",
            border: "none",
            fontSize: "18px",
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>

      <p style={{ marginTop: "5px" }}>
        Tienes <b>{summary.total_unread}</b> mensajes sin leer.
      </p>

      {/* 1 chat */}
      {chats.length === 1 ? (
        <>
          <p>
            De <b>{chats[0].other_user_name}</b> en{" "}
            <b>{chats[0].trip_title}</b>.
          </p>
          <button
            onClick={() => handleOpenChat(chats[0])}
            style={{
              marginTop: "10px",
              width: "100%",
              padding: "10px",
              background: "#4f46e5",
              color: "white",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
            }}
          >
            {chats[0].is_group_chat ? "Ver viaje" : "Abrir chat"}
          </button>
        </>
      ) : (
        <>
          <p style={{ marginTop: "10px" }}>Elige qué chat quieres abrir:</p>
          <ul style={{ marginTop: "8px" }}>
            {chats.map((c) => (
              <li
                key={c.chat_id}
                onClick={() => handleOpenChat(c)}
                style={{
                  marginBottom: "6px",
                  cursor: "pointer",
                  listStyle: "square",
                }}
              >
                {c.is_group_chat ? (
                  <>
                    <b>Chat grupal</b> — {c.trip_title} ({c.unread_count} sin leer)
                  </>
                ) : (
                  <>
                    <b>{c.other_user_name}</b> — {c.trip_title} ({c.unread_count} sin leer)
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
