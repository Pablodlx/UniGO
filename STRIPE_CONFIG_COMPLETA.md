# 🔑 Configuración Completa de Stripe - UniGO

## ✅ Archivos Actualizados

### 1. backend/.env

Las siguientes variables de Stripe han sido agregadas al final del archivo `backend/.env`:

```env
# Stripe Payment Configuration
STRIPE_SECRET_KEY=sk_test_51RZYUaPe1uq215LfzQHdp7POuPuXr61nHexgthLwmQm8QkTx11zgITXvIdb7ORoRuBvdZYn3gKu6TUcwFA1WeUkz00L6NX5ce4
STRIPE_PUBLIC_KEY=pk_test_51RZYUaPe1uq215LfbZ5dXkNH0sV9Wql8rEZMynq8ffqCL8Pjg14TWyGD1fv3f9wJeLTmf5qSU7xu10SCXn9aZydY00aVO9bssy
STRIPE_WEBHOOK_SECRET=whsec_placeholder_replace_with_real_secret
APP_COMMISSION_PERCENT=15
```

### 2. frontend/.env.local

El archivo `frontend/.env.local` contiene:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyCVIhHblM1z5tC60ZB6C7FsKMNOdkaVd9k

# Stripe Payment Configuration
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_51RZYUaPe1uq215LfbZ5dXkNH0sV9Wql8rEZMynq8ffqCL8Pjg14TWyGD1fv3f9wJeLTmf5qSU7xu10SCXn9aZydY00aVO9bssy
```

---

## 🔐 Generar STRIPE_WEBHOOK_SECRET

### Paso 1: Instalar Stripe CLI (si no lo tienes)

**macOS (con Homebrew):**
```bash
brew install stripe/stripe-cli/stripe
```

**Linux:**
```bash
wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_*_linux_x86_64.tar.gz
tar -xvf stripe_*_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

**Windows (con Scoop):**
```bash
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

### Paso 2: Autenticarte con Stripe

```bash
stripe login
```

Esto abrirá tu navegador para autenticarte. Copia la clave de API que se muestre (debe coincidir con tu `STRIPE_SECRET_KEY`).

### Paso 3: Iniciar el listener de webhooks

**Comando EXACTO que debes ejecutar:**

```bash
stripe listen --forward-to http://127.0.0.1:8000/api/payments/webhook
```

**Nota:** La ruta completa del webhook es `/api/payments/webhook` porque:
- El router tiene prefix `/payments`
- Se incluye en main.py con prefix `/api`
- El endpoint se define como `/webhook` en el router

### Paso 4: Copiar el Webhook Secret

Después de ejecutar el comando anterior, verás algo como:

```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (^C to quit)
```

**Copia el valor que aparece después de `whsec_`** (ejemplo: `whsec_1234567890abcdef...`)

### Paso 5: Actualizar backend/.env

Abre `backend/.env` y reemplaza la línea:

```env
STRIPE_WEBHOOK_SECRET=whsec_placeholder_replace_with_real_secret
```

Por:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**(Usa el valor real que obtuviste del comando `stripe listen`)**

---

## 📋 Resumen Final

### backend/.env - Sección de Stripe

```env
# Stripe Payment Configuration
STRIPE_SECRET_KEY=sk_test_51RZYUaPe1uq215LfzQHdp7POuPuXr61nHexgthLwmQm8QkTx11zgITXvIdb7ORoRuBvdZYn3gKu6TUcwFA1WeUkz00L6NX5ce4
STRIPE_PUBLIC_KEY=pk_test_51RZYUaPe1uq215LfbZ5dXkNH0sV9Wql8rEZMynq8ffqCL8Pjg14TWyGD1fv3f9wJeLTmf5qSU7xu10SCXn9aZydY00aVO9bssy
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
APP_COMMISSION_PERCENT=15
```

**⚠️ IMPORTANTE:** Reemplaza `whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` con el valor real obtenido del comando `stripe listen`.

### frontend/.env.local

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyCVIhHblM1z5tC60ZB6C7FsKMNOdkaVd9k

# Stripe Payment Configuration
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_51RZYUaPe1uq215LfbZ5dXkNH0sV9Wql8rEZMynq8ffqCL8Pjg14TWyGD1fv3f9wJeLTmf5qSU7xu10SCXn9aZydY00aVO9bssy
```

---

## ✅ Verificación

Después de configurar todo:

1. **Reinicia el backend** para que cargue las nuevas variables de entorno
2. **Reinicia el frontend** para que cargue la nueva variable de Stripe
3. **Mantén el comando `stripe listen` ejecutándose** en una terminal separada mientras desarrollas

El webhook secret cambia cada vez que reinicias `stripe listen`, así que asegúrate de actualizar `backend/.env` si lo reinicias.

---

**✅ Configuración completada con tus claves reales de Stripe (modo test)**

