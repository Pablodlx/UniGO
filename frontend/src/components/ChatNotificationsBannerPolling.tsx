"use client";

import { useChatNotificationsPolling } from "@/hooks/useChatNotificationsPolling";
import { markNotificationRead, ChatNotification } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function ChatNotificationsBannerPolling() {
  const { bannerNotifications, visible, refresh, dismissedIds, setDismissedIds } = useChatNotificationsPolling();
  const router = useRouter();

  const getAvatarUrl = (avatarUrl: string | null | undefined): string => {
    if (!avatarUrl) return "/default-avatar.png";
    
    // If it's already a full URL, return it as is
    if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
      return avatarUrl;
    }
    
    // Otherwise, construct the full URL using the API base
    const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000/api";
    const baseUrl = BASE.replace('/api', '');
    return `${baseUrl}${avatarUrl}`;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Ahora";
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffMins < 1440) {
      const hours = Math.floor(diffMins / 60);
      return `Hace ${hours}h`;
    }

    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Extract message preview (remove sender name if present)
  const getMessagePreview = (notification: ChatNotification): string => {
    const msg = notification.message;
    if (msg.includes(": ")) {
      return msg.split(": ").slice(1).join(": ");
    }
    return msg;
  };

  const handleOpen = async (notification: ChatNotification) => {
    try {
      // 1. Marcar solo esta notificación como leída
      await markNotificationRead(notification.id);
      
      // 2. Refrescar para obtener el estado actualizado (esta notificación desaparecerá)
      setTimeout(() => {
        refresh();
      }, 300);
      
      // 3. Navegar al chat correspondiente
      if (notification.ride_id) {
        // Para chats grupales, usar openChat
        if (notification.type === "new_group_message") {
          router.push(`/my-rides?openChat=${notification.ride_id}`);
        } else {
          // Para chats 1-to-1, navegar directamente
          router.push(`/chat/${notification.ride_id}`);
        }
      }
    } catch (error) {
      console.error("Error opening notification:", error);
      // Still navigate even if marking as read fails
      if (notification.ride_id) {
        if (notification.type === "new_group_message") {
          router.push(`/my-rides?openChat=${notification.ride_id}`);
        } else {
          router.push(`/chat/${notification.ride_id}`);
        }
      }
      setTimeout(() => {
        refresh();
      }, 300);
    }
  };

  const handleDismiss = async (notification: ChatNotification) => {
    try {
      // 1. NO marcar como leída en el backend
      // Solo ocultar localmente para que cuando lleguen nuevas notificaciones,
      // el polling traiga todas las no leídas (incluyendo las descartadas)
      
      // 2. Agregar a la lista de descartadas localmente
      // Esto oculta la notificación inmediatamente
      setDismissedIds(prev => new Set(prev).add(notification.id));
      
      // 3. NO refrescar aquí - la notificación seguirá en el backend como no leída
      // pero estará oculta localmente hasta que lleguen nuevas notificaciones
    } catch (error) {
      console.error("Error dismissing notification:", error);
    }
  };


  // Validar que bannerNotifications es un array
  if (!visible || !Array.isArray(bannerNotifications) || bannerNotifications.length === 0) {
    return null;
  }

  // Filtrar notificaciones: ocultar las que están en dismissedIds
  // Cuando llegan nuevas notificaciones, el useEffect limpia dismissedIds
  // y todas las notificaciones (incluyendo las descartadas) vuelven a aparecer
  const filteredNotifications = bannerNotifications.filter(notif => notif && !dismissedIds.has(notif.id));

  if (filteredNotifications.length === 0) {
    return null;
  }

  // Agrupar notificaciones por chat (ride_id)
  // Solo agrupar si hay múltiples notificaciones del mismo chat
  const notificationsByChat = filteredNotifications.reduce((acc, notification) => {
    const chatKey = notification.ride_id || 'unknown';
    if (!acc[chatKey]) {
      acc[chatKey] = [];
    }
    acc[chatKey].push(notification);
    return acc;
  }, {} as Record<string | number, ChatNotification[]>);

  // Convertir a array de grupos, pero solo agrupar si hay más de 1 notificación
  const chatGroups = Object.entries(notificationsByChat).map(([chatKey, notifications]) => {
    // Si solo hay 1 notificación, no agrupar (mostrar individual)
    // Si hay 2+, agrupar
    return {
      chatKey,
      notifications,
      shouldGroup: notifications.length > 1
    };
  });

  const handleViewAllMessages = async (notifications: ChatNotification[]) => {
    try {
      // Marcar todas las notificaciones de este chat como leídas
      const markAllPromises = notifications.map(notif => markNotificationRead(notif.id));
      await Promise.all(markAllPromises);
      
      // Refrescar para obtener el estado actualizado
      setTimeout(() => {
        refresh();
      }, 300);
      
      // Navegar al chat correspondiente
      if (notifications[0]?.ride_id) {
        const firstNotif = notifications[0];
        if (firstNotif.type === "new_group_message") {
          router.push(`/my-rides?openChat=${firstNotif.ride_id}`);
        } else {
          router.push(`/chat/${firstNotif.ride_id}`);
        }
      }
    } catch (error) {
      console.error("Error viewing all messages:", error);
      // Still navigate even if marking as read fails
      if (notifications[0]?.ride_id) {
        const firstNotif = notifications[0];
        if (firstNotif.type === "new_group_message") {
          router.push(`/my-rides?openChat=${firstNotif.ride_id}`);
        } else {
          router.push(`/chat/${firstNotif.ride_id}`);
        }
      }
      setTimeout(() => {
        refresh();
      }, 300);
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
        borderRadius: "10px",
        width: "360px",
        maxHeight: "500px",
        overflowY: "auto",
        boxShadow: "0 4px 15px rgba(0,0,0,0.15)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "15px",
          borderBottom: "1px solid #eee",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          background: "white",
          zIndex: 1,
        }}
      >
        <strong style={{ fontSize: "16px" }}>Mensajes nuevos</strong>
        <span style={{ fontSize: "12px", color: "#666" }}>
          {filteredNotifications.length}
        </span>
      </div>

      <div style={{ padding: "10px" }}>
        {chatGroups.map(({ chatKey, notifications, shouldGroup }) => {
          const firstNotif = notifications[0];
          const unreadCount = notifications.length;

          // Si no debe agrupar, mostrar cada notificación individualmente
          if (!shouldGroup) {
            return notifications.map((notification) => (
              <div
                key={notification.id}
                style={{
                  padding: "12px",
                  marginBottom: "8px",
                  border: "1px solid #eee",
                  borderRadius: "8px",
                  background: "#f9f9f9",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    marginBottom: "8px",
                  }}
                >
                  {/* Avatar */}
                  <img
                    src={getAvatarUrl(notification.sender_avatar_url)}
                    alt={notification.sender_name}
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/default-avatar.png";
                    }}
                  />

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "4px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: "600",
                            fontSize: "14px",
                            color: "#333",
                          }}
                        >
                          {notification.sender_name}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#666",
                            marginTop: "2px",
                          }}
                        >
                          {notification.trip_title || "Chat"}
                        </div>
                      </div>
                    </div>

                    {/* Message preview */}
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#555",
                        marginTop: "4px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {getMessagePreview(notification)}
                    </div>

                    {/* Time */}
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#999",
                        marginTop: "4px",
                      }}
                    >
                      {formatTime(notification.created_at)}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginTop: "8px",
                  }}
                >
                  <button
                    onClick={() => handleOpen(notification)}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      background: "#86efac",
                      color: "#166534",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "500",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = "#4ade80";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = "#86efac";
                    }}
                  >
                    Abrir
                  </button>
                  <button
                    onClick={() => handleDismiss(notification)}
                    style={{
                      padding: "8px 12px",
                      background: "#e5e7eb",
                      color: "#374151",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: "500",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = "#d1d5db";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = "#e5e7eb";
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ));
          }

          // Si debe agrupar (múltiples notificaciones del mismo chat)
          return (
            <div
              key={chatKey}
              style={{
                marginBottom: "12px",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              {/* Header del grupo con botón "Ver mensajes" */}
              {shouldGroup && (
                <div
                  style={{
                    padding: "10px 12px",
                    background: "#f3f4f6",
                    borderBottom: "1px solid #e5e7eb",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: "600",
                        fontSize: "13px",
                        color: "#333",
                      }}
                    >
                      {firstNotif.trip_title || "Chat"}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#666",
                        marginTop: "2px",
                      }}
                    >
                      {unreadCount} mensajes sin leer
                    </div>
                  </div>
                  <button
                    onClick={() => handleViewAllMessages(notifications)}
                    style={{
                      padding: "6px 12px",
                      background: "#86efac",
                      color: "#166534",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "500",
                      whiteSpace: "nowrap",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = "#4ade80";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = "#86efac";
                    }}
                  >
                    Ver mensajes
                  </button>
                </div>
              )}

              {/* Lista de notificaciones del grupo */}
              <div style={{ padding: shouldGroup ? "8px" : "10px" }}>
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    style={{
                      padding: "12px",
                      marginBottom: shouldGroup ? "8px" : "0",
                      border: shouldGroup ? "1px solid #eee" : "none",
                      borderRadius: shouldGroup ? "8px" : "0",
                      background: shouldGroup ? "#f9f9f9" : "transparent",
                    }}
                  >
            <div
              style={{
                display: "flex",
                gap: "10px",
                marginBottom: "8px",
              }}
            >
              {/* Avatar */}
              <img
                src={getAvatarUrl(notification.sender_avatar_url)}
                alt={notification.sender_name}
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  flexShrink: 0,
                }}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/default-avatar.png";
                }}
              />

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "4px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: "600",
                        fontSize: "14px",
                        color: "#333",
                      }}
                    >
                      {notification.sender_name}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        marginTop: "2px",
                      }}
                    >
                      {notification.trip_title || "Chat"}
                    </div>
                  </div>
                </div>

                {/* Message preview */}
                <div
                  style={{
                    fontSize: "13px",
                    color: "#555",
                    marginTop: "4px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {getMessagePreview(notification)}
                </div>

                {/* Time */}
                <div
                  style={{
                    fontSize: "11px",
                    color: "#999",
                    marginTop: "4px",
                  }}
                >
                  {formatTime(notification.created_at)}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginTop: "8px",
              }}
            >
              <button
                onClick={() => handleOpen(notification)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  background: "#86efac",
                  color: "#166534",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "500",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "#4ade80";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "#86efac";
                }}
              >
                Abrir
              </button>
              <button
                onClick={() => handleDismiss(notification)}
                style={{
                  padding: "8px 12px",
                  background: "#e5e7eb",
                  color: "#374151",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "500",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "#d1d5db";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "#e5e7eb";
                }}
              >
                ✕
              </button>
            </div>
          </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

