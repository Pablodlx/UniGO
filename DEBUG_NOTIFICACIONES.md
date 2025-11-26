# 🔍 Guía de Debugging para Notificaciones

## ✅ Verificaciones Rápidas

### 1. Backend está corriendo
```bash
curl http://127.0.0.1:8000/health
```
Debe responder: `{"status":"ok"}`

### 2. Endpoint funciona
```bash
# Primero obtén un token (haz login en el frontend)
# Luego en la consola del navegador:
const token = localStorage.getItem("token");
fetch("http://127.0.0.1:8000/api/chat/unread-summary", {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json()).then(console.log);
```

### 3. Verificar en la Consola del Navegador

Abre la consola (F12) y busca estos logs:

**✅ Logs esperados:**
```
UnreadMessagesBannerWrapper - Token from localStorage: Found
UnreadMessagesBannerWrapper - Rendering banner with token.
useUnreadBanner: Setting up polling with token
useUnreadBanner: Fetching from: http://127.0.0.1:8000/api/chat/unread-summary
useUnreadBanner: Response status: 200 OK
useUnreadBanner: Received data: {"total_unread": 2, ...}
useUnreadBanner: ✅ Showing banner...
```

**❌ Si ves errores:**
- `Response status: 401` → Token inválido o expirado
- `Response status: 404` → Endpoint no encontrado
- `Failed to fetch` → Backend no está corriendo

### 4. Verificar localStorage

En la consola del navegador:
```javascript
// Verificar token
console.log("Token:", localStorage.getItem("token"));

// Verificar lastDismissedMessageId
console.log("Last dismissed:", localStorage.getItem("lastDismissedMessageId"));

// Si lastDismissedMessageId es muy alto, borrarlo:
localStorage.removeItem("lastDismissedMessageId");
```

### 5. Probar manualmente el endpoint

En la consola del navegador:
```javascript
const token = localStorage.getItem("token");
fetch("http://127.0.0.1:8000/api/chat/unread-summary", {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  }
})
.then(r => {
  console.log("Status:", r.status);
  return r.json();
})
.then(data => {
  console.log("Data:", data);
  console.log("Total unread:", data.total_unread);
  console.log("Max message ID:", data.max_message_id);
});
```

## 🐛 Problemas Comunes

### Problema: "Not authenticated" (401)
**Solución:**
1. El token puede estar expirado
2. Haz login de nuevo
3. Verifica que el token se guarda: `localStorage.getItem("token")`

### Problema: Banner no aparece aunque hay mensajes
**Solución:**
1. Verifica `lastDismissedMessageId`:
   ```javascript
   const lastDismissed = Number(localStorage.getItem("lastDismissedMessageId") || "0");
   console.log("Last dismissed:", lastDismissed);
   ```
2. Si es mayor que el `max_message_id`, borra el valor:
   ```javascript
   localStorage.removeItem("lastDismissedMessageId");
   ```
3. Recarga la página

### Problema: No se hace polling
**Solución:**
1. Verifica que el token existe
2. Abre la consola y busca: `useUnreadBanner: Polling interval set up`
3. Espera 20 segundos y busca: `useUnreadBanner: Polling interval triggered`

## 📝 Logs de Debugging

Todos los logs importantes empiezan con `useUnreadBanner:`. Busca:
- `Setting up polling` → Hook inicializado
- `Fetching from` → URL del endpoint
- `Response status` → Estado de la respuesta
- `Received data` → Datos recibidos
- `Showing banner` → Banner debe aparecer
- `Hiding banner` → Banner oculto

