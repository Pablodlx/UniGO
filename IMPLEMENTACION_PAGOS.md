# Implementación del Sistema de Pagos con Stripe - UniGO

Este documento describe la implementación completa del sistema de pagos con Stripe en UniGO.

## 📋 Resumen de Cambios

### Backend

1. **Modelos nuevos**:
   - `Payment` model en `backend/app/payments/models.py`
   - Campos Stripe agregados a `User` model

2. **Servicios nuevos**:
   - `backend/app/core/stripe.py` - Cliente y utilidades de Stripe
   - `backend/app/payments/service.py` - Lógica de negocio de pagos

3. **Endpoints nuevos**:
   - `POST /api/payments/create-setup-intent` - Crear SetupIntent
   - `POST /api/payments/confirm-setup-intent` - Confirmar y guardar método de pago
   - `POST /api/payments/webhook` - Webhook de Stripe
   - `POST /api/rides/{ride_id}/complete` - Completar viaje y capturar pago

4. **Endpoints modificados** (sin romper funcionalidad existente):
   - `POST /api/bookings/{booking_id}/accept` - Ahora crea PaymentIntent
   - `POST /api/rides/{ride_id}/cancel-booking` - Maneja penalizaciones

5. **Migración**:
   - Alembic migration para tabla `payments` y campos Stripe en `users`

### Frontend

1. **Componentes nuevos**:
   - `frontend/src/components/PaymentForm.tsx` - Formulario de Stripe Elements
   - `frontend/src/components/PaymentModal.tsx` - Modal de pago

2. **Integraciones**:
   - StripeProvider en `frontend/src/app/layout.tsx`
   - Integración en flujo de booking

3. **Dependencias nuevas**:
   - `@stripe/react-stripe-js`
   - `@stripe/stripe-js`

## 🔧 Configuración

### Variables de Entorno (.env)

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLIC_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
APP_COMMISSION_PERCENT=15
```

### Instalación

```bash
# Backend
cd backend
pip install stripe

# Frontend
cd frontend
npm install @stripe/react-stripe-js @stripe/stripe-js
```

### Migraciones

```bash
cd backend
alembic upgrade head
```

## 📝 Flujo de Pagos

### 1. Guardar Tarjeta (Al crear reserva)

1. Pasajero crea reserva → estado `pending`
2. Frontend muestra modal de pago
3. Se crea SetupIntent
4. Usuario ingresa datos de tarjeta
5. Se confirma SetupIntent
6. Se guardan `stripe_customer_id` y `stripe_payment_method_id` en User

### 2. Retener Pago (Al aceptar reserva)

1. Conductor acepta reserva
2. Se crea PaymentIntent con:
   - `capture_method='manual'`
   - `confirm=True`
   - `off_session=True`
3. Se guarda PaymentIntent en tabla `payments`
4. El pago se retiene (no se cobra)

### 3. Capturar Pago (Al completar viaje)

1. Viaje se marca como completado
2. Se llama a `PaymentIntent.capture()`
3. Se calcula comisión de app (15%)
4. Se actualiza estado del pago a `succeeded`

### 4. Penalizaciones (Al cancelar)

**Pasajero:**
- >24h antes: 0% (cancel PaymentIntent)
- 12-24h: 30%
- 6-12h: 50%
- ≤6h: 80%

**Conductor:**
- <24h antes: 50% (solo guardar, no cobrar)

## 🔒 Seguridad

- Todos los pagos son backend-driven
- Frontend solo maneja SetupIntent (guardar tarjeta)
- PaymentIntent se crea y confirma en backend
- Webhook verificado con secreto
- Manejo de errores completo

## 🧪 Testing

Ver `backend/tests/test_payments.py` para ejemplos de testing.

## 📚 Documentación Adicional

- [Stripe Payment Intents](https://stripe.com/docs/payments/payment-intents)
- [Stripe Setup Intents](https://stripe.com/docs/payments/setup-intents)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)

