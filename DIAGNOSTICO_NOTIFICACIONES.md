# 🔍 Diagnóstico de Notificaciones

## Pasos para diagnosticar el problema:

### 1. Verificar Backend
```bash
curl http://127.0.0.1:8000/health
```
Debe responder: `{"status":"ok"}`

### 2. Verificar Endpoint con Token
Abre la consola del navegador (F12) y ejecuta:

```javascript
// 1. Obtener tu token
const token = localStorage.getItem("token");
console.log("Token:", token ? "Encontrado" : "NO ENCONTRADO");

// 2. Probar el endpoint manualmente
if (token) {
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
    console.log("Respuesta:", data);
    console.log("Total sin leer:", data.total_unread);
  })
  .catch(err => console.error("Error:", err));
}
```

### 3. Verificar Logs en Consola
Busca estos logs en la consola:

**✅ Logs esperados:**
- `UnreadMessagesBannerWrapper - Token from localStorage: Found`
- `useUnreadBanner: Setting up polling with token`
- `useUnreadBanner: Fetching from: http://127.0.0.1:8000/api/chat/unread-summary`
- `useUnreadBanner: Response status: 200 OK`
- `useUnreadBanner: Received data: {...}`

**❌ Si ves errores:**
- `Response status: 401` → Token inválido o expirado
- `Response status: 404` → Endpoint no encontrado
- `Failed to fetch` → Backend no está corriendo
- `No token available` → Token no está en localStorage

### 4. Verificar localStorage
```javascript
// Verificar token
console.log("Token:", localStorage.getItem("token"));

// Verificar lastDismissedMessageId
console.log("Last dismissed:", localStorage.getItem("lastDismissedMessageId"));

// Si lastDismissedMessageId es muy alto, borrarlo:
localStorage.removeItem("lastDismissedMessageId");
```

### 5. Verificar que hay mensajes sin leer
El banner solo aparece si:
- Hay mensajes con `read_at IS NULL`
- El `max_message_id` es mayor que `lastDismissedMessageId`

Si no hay mensajes, el banner no aparecerá (esto es correcto).

### 6. Forzar recarga del hook
```javascript
// Recargar la página
window.location.reload();
```

## Problemas Comunes y Soluciones

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

### Problema: Navegación no funciona
**Solución:**
1. Verifica que la ruta `/chat/[tripId]` existe
2. Verifica que el `chatId` es un número válido
3. Revisa la consola para errores de navegación

