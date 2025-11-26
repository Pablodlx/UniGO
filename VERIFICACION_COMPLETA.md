# 🔍 Verificación Completa del Sistema de Notificaciones

## Pasos para Verificar que Funciona

### 1. Verificar Backend
```bash
cd backend && source .venv/bin/activate
python3 << 'EOF'
from app.db.session import SessionLocal
from app.auth.models import User
from app.chat.router import get_unread_summary

db = SessionLocal()
user = db.query(User).filter(User.email == "santiago@ceu.es").first()

class MockUser:
    def __init__(self, user):
        self.id = user.id
        self.email = user.email
        self.full_name = user.full_name

result = get_unread_summary(db=db, current_user=MockUser(user))
print(f"Total sin leer: {result['total_unread']}")
print(f"Max message ID: {result['max_message_id']}")
print(f"Chats: {len(result['chats'])}")
db.close()
EOF
```

### 2. Verificar Frontend - Consola del Navegador

Abre la consola (F12) y ejecuta:

```javascript
// 1. Verificar token
const token = localStorage.getItem("token");
console.log("Token:", token ? "✅ Encontrado" : "❌ NO ENCONTRADO");

// 2. Probar endpoint manualmente
if (token) {
  fetch("http://127.0.0.1:8000/api/chat/unread-summary", {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  })
  .then(r => {
    console.log("Status:", r.status);
    return r.json();
  })
  .then(data => {
    console.log("✅ Respuesta:", data);
    console.log("Total sin leer:", data.total_unread);
    console.log("Max message ID:", data.max_message_id);
    console.log("Chats:", data.chats.length);
  })
  .catch(err => console.error("❌ Error:", err));
}

// 3. Verificar lastDismissedMessageId
const lastDismissed = Number(localStorage.getItem("lastDismissedMessageId") || "0");
console.log("Last dismissed:", lastDismissed);

// 4. Si lastDismissed es muy alto, borrarlo
if (lastDismissed > 100) {
  console.log("⚠️ lastDismissed es muy alto, borrándolo...");
  localStorage.removeItem("lastDismissedMessageId");
  console.log("✅ Borrado. Recarga la página.");
}
```

### 3. Verificar Logs en Consola

Busca estos logs en la consola del navegador:

**✅ Logs esperados:**
- `UnreadMessagesBannerWrapper - Token from localStorage: Found`
- `useUnreadBanner: Setting up polling with token`
- `useUnreadBanner: Fetching from: http://127.0.0.1:8000/api/chat/unread-summary`
- `useUnreadBanner: Response status: 200 OK`
- `useUnreadBanner: Received data: {...}`
- `useUnreadBanner: ✅ Showing banner` (si hay mensajes nuevos)

**❌ Si ves errores:**
- `Response status: 401` → Token inválido o expirado
- `Response status: 404` → Endpoint no encontrado
- `Failed to fetch` → Backend no está corriendo
- `No token available` → Token no está en localStorage

### 4. Verificar que hay Mensajes Nuevos

El banner solo aparece si:
- `total_unread > 0` Y
- `max_message_id > lastDismissedMessageId`

Si el último mensaje es del usuario, no aparecerá (esto es correcto).

### 5. Forzar Recarga

```javascript
// Borrar lastDismissedMessageId y recargar
localStorage.removeItem("lastDismissedMessageId");
window.location.reload();
```

## Problemas Comunes

### El banner no aparece aunque hay mensajes
1. Verifica `lastDismissedMessageId`:
   ```javascript
   const lastDismissed = Number(localStorage.getItem("lastDismissedMessageId") || "0");
   console.log("Last dismissed:", lastDismissed);
   ```
2. Si es mayor que `max_message_id`, borra el valor y recarga

### El polling no funciona
1. Verifica que el token existe
2. Busca en consola: `useUnreadBanner: Polling interval set up`
3. Espera 20 segundos y busca: `useUnreadBanner: Polling interval triggered`

### Error 401 "Not authenticated"
- El token puede estar expirado
- Haz login de nuevo
- Verifica: `localStorage.getItem("token")`

