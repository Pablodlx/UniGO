# 💳 Guía Completa de Implementación - Sistema de Pagos Stripe

## ✅ Lo que ya está implementado

1. ✅ Modelo `Payment` creado (`backend/app/payments/models.py`)
2. ✅ Campos Stripe agregados al modelo `User`
3. ✅ Servicio base de Stripe (`backend/app/core/stripe.py`)
4. ✅ Servicio de pagos con penalizaciones (`backend/app/payments/service.py`)
5. ✅ Configuración actualizada (`backend/app/core/config.py`)

## 📝 Lo que falta implementar

### Backend (Crítico)

1. **Schemas de Pagos** (`backend/app/payments/schemas.py`)
2. **Router de Pagos** (`backend/app/payments/router.py`)
3. **Migración Alembic** para tabla payments
4. **Actualizar main.py** para importar modelos y router de pagos
5. **Integrar PaymentIntent** en `accept_booking` (sin romper lógica existente)
6. **Endpoint para completar viaje** y capturar pago
7. **Actualizar cancel_booking** para usar penalizaciones

### Frontend

1. **StripeProvider** en layout
2. **PaymentForm component**
3. **PaymentModal component**
4. **Integración en flujo de booking**

## 🔧 Instrucciones de Implementación

### Paso 1: Dependencias

```bash
# Backend
cd backend
pip install stripe
echo "stripe>=7.0.0" >> requirements.txt

# Frontend
cd frontend
npm install @stripe/react-stripe-js @stripe/stripe-js
```

### Paso 2: Variables de Entorno

Agregar a `backend/.env`:

```env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLIC_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
APP_COMMISSION_PERCENT=15
```

### Paso 3: Crear archivos faltantes

Ver archivos individuales para código completo de:
- `backend/app/payments/schemas.py`
- `backend/app/payments/router.py`
- Migración Alembic
- Componentes frontend

### Paso 4: Integrar sin romper

- Todos los endpoints existentes mantienen su comportamiento
- Los cambios son solo aditivos
- Verificación paso a paso

## 📚 Documentación Adicional

- `IMPLEMENTACION_PAGOS.md` - Flujos detallados
- `STRIPE_COMPLETE_IMPLEMENTATION.md` - Estado de implementación

---

**Nota**: Esta implementación está diseñada para ser aplicada de forma incremental sin afectar funcionalidad existente. Todos los cambios son aditivos o extensivos.

