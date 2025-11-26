# 🔍 Diagnóstico de "Load Failed" en PassengersSection

## Pasos para diagnosticar:

### 1. Verificar que el backend está corriendo
```bash
curl http://127.0.0.1:8000/health
```
Debe responder: `{"status":"ok"}`

### 2. Verificar que el endpoint existe
Abre en el navegador: `http://127.0.0.1:8000/docs`

Busca el endpoint: `GET /api/rides/{ride_id}/passengers`

### 3. Verificar en la consola del navegador (F12)
Busca estos logs cuando hagas clic en "Ver pasajeros":
- `PassengersSection: Fetching passengers for ride X`
- `getRidePassengersForDriver: Calling http://127.0.0.1:8000/api/rides/X/passengers`
- `Fetching: http://127.0.0.1:8000/api/rides/X/passengers`
- `Response status: XXX`

### 4. Probar el endpoint manualmente
Abre la consola del navegador (F12) y ejecuta:

```javascript
const token = localStorage.getItem("token");
const rideId = 1; // Cambia por el ID de tu viaje

fetch(`http://127.0.0.1:8000/api/rides/${rideId}/passengers`, {
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  }
})
.then(r => {
  console.log("Status:", r.status);
  if (!r.ok) {
    return r.text().then(text => {
      console.error("Error:", text);
      throw new Error(text);
    });
  }
  return r.json();
})
.then(data => {
  console.log("✅ Respuesta:", data);
})
.catch(err => {
  console.error("❌ Error:", err);
});
```

### 5. Verificar que eres el conductor
El endpoint solo funciona si el usuario actual es el conductor del viaje.

### 6. Reiniciar el servidor backend
Si el endpoint no aparece en `/docs`, reinicia el servidor:

```bash
# Detener el servidor (Ctrl+C)
# Luego reiniciar:
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Errores comunes:

- **404 Not Found**: El endpoint no está registrado → Reinicia el backend
- **403 Forbidden**: No eres el conductor del viaje
- **401 Unauthorized**: Token inválido o expirado → Haz login de nuevo
- **CORS Error**: Verifica que el backend tenga CORS configurado

