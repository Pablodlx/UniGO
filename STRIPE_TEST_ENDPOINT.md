# 🧪 Endpoint Temporal para Añadir Fondos de Prueba

## ⚠️ IMPORTANTE: Este endpoint es TEMPORAL y debe eliminarse antes de producción

---

## 📋 Descripción

Este endpoint añade fondos al balance de tu plataforma en Stripe test mode usando el token especial `tok_bypassPending`. Esto resuelve el error "insufficient funds" que impide crear Transfers en modo test.

---

## 🔧 Endpoint

```
POST /api/payments/test/add-funds?amount_eur=50
```

### Parámetros:
- `amount_eur` (query param, opcional): Cantidad en euros a añadir (default: 50.0, max: 10000)

### Headers requeridos:
- `Authorization: Bearer {token}`

---

## 🚀 Cómo Usarlo

### Opción 1: Desde curl

```bash
curl -X POST "http://localhost:8000/api/payments/test/add-funds?amount_eur=100" \
     -H "Authorization: Bearer TU_TOKEN_AQUI"
```

### Opción 2: Desde el frontend (JavaScript)

```javascript
const addTestFunds = async () => {
  const token = localStorage.getItem('token'); // o getToken()
  
  try {
    const response = await fetch('/api/payments/test/add-funds?amount_eur=100', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Fondos añadidos:', data.details);
      console.log(`💰 Nuevo balance: €${data.details.available_balance_eur}`);
      alert(`Balance actualizado: €${data.details.available_balance_eur}`);
    } else {
      console.error('❌ Error:', data);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
};

// Llamar la función
addTestFunds();
```

### Opción 3: Botón temporal en el dashboard

Añade esto temporalmente en alguna página del dashboard (ej: `/profile`):

```tsx
// Añadir al componente
const [loading, setLoading] = useState(false);

const handleAddFunds = async () => {
  setLoading(true);
  const token = getToken();
  
  try {
    const response = await fetch('/api/payments/test/add-funds?amount_eur=100', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    if (data.success) {
      alert(`✅ Balance actualizado: €${data.details.available_balance_eur}`);
    }
  } catch (error) {
    alert('❌ Error añadiendo fondos');
  } finally {
    setLoading(false);
  }
};

// En el JSX (temporalmente)
<button 
  onClick={handleAddFunds}
  disabled={loading}
  className="bg-yellow-500 text-white px-4 py-2 rounded"
>
  {loading ? 'Añadiendo...' : '🧪 Añadir Fondos Test'}
</button>
```

---

## 📊 Respuesta del Endpoint

### Success (200):

```json
{
  "success": true,
  "message": "Successfully added €100 to test balance",
  "details": {
    "success": true,
    "charge_id": "ch_xxxxxxxxxxxxx",
    "amount_added_cents": 10000,
    "amount_added_eur": 100.0,
    "charge_status": "succeeded",
    "available_balance_cents": 10000,
    "available_balance_eur": 100.0,
    "pending_balance_cents": 0,
    "pending_balance_eur": 0.0
  }
}
```

### Error (403 - No test mode):

```json
{
  "detail": "This endpoint can only be used in test mode"
}
```

---

## 🔒 Seguridad

- ✅ Solo funciona si `STRIPE_SECRET_KEY` empieza con `sk_test_`
- ✅ Requiere autenticación (Bearer token)
- ✅ Valida que el monto esté entre 0.01 y 10000 EUR
- ✅ No afecta ningún código de producción

---

## 💡 Flujo Completo

1. **Añadir fondos:**
   ```bash
   POST /api/payments/test/add-funds?amount_eur=100
   ```

2. **Completar un viaje:**
   - El viaje se completa normalmente
   - Se captura el PaymentIntent
   - Se crea el Transfer automáticamente
   - ✅ Ahora SÍ funciona porque hay balance disponible

3. **Verificar en Stripe Dashboard:**
   - Ve a: Balance → Transfers
   - Deberías ver el transfer creado

---

## 🧹 Eliminar Antes de Producción

Cuando vayas a producción, **DEBES ELIMINAR**:

1. **Archivo:**
   ```bash
   rm backend/app/payments/test_utils.py
   ```

2. **En `backend/app/payments/router.py`:**
   - Eliminar el import: `from app.payments.test_utils import add_test_balance, is_test_mode`
   - Eliminar todo el bloque del endpoint (líneas con comentario "TEMPORARY TEST ENDPOINT")

3. **Cualquier botón temporal** que hayas añadido en el frontend

---

## 🎯 En Producción

En producción, este problema **NO existe** porque:
- Los fondos capturados están disponibles inmediatamente
- Los Transfers se crean sin errores
- No necesitas añadir fondos manualmente

---

## ❓ FAQ

**P: ¿Por qué necesito esto?**  
R: En test mode, Stripe no hace disponibles los fondos inmediatamente. Este endpoint usa un token especial de Stripe para añadir fondos al balance.

**P: ¿Es seguro?**  
R: Sí, solo funciona en test mode y requiere autenticación. Además, no afecta ningún código de producción.

**P: ¿Cuánto debo añadir?**  
R: Depende de cuántos viajes quieras probar. 50-100€ suele ser suficiente para varias pruebas.

**P: ¿Qué pasa si lo olvido en producción?**  
R: El endpoint verificará que NO estés en test mode y devolverá un error 403. Pero aún así, debes eliminarlo.

---

## 📝 Logs

El endpoint genera logs detallados:

```
[TEST UTILS] Adding 10000 cents to test balance...
[TEST UTILS] ✅ Charge created: ch_xxxxx
[TEST UTILS] Amount: 10000 cents (€100.00)
[TEST UTILS] Status: succeeded
[TEST UTILS] New available balance: 10000 cents (€100.00)
```

---

**Creado:** 2 Dic 2025  
**Autor:** Cursor AI  
**Propósito:** Testing Stripe Transfers en modo test

