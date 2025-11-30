# 📧 Guía Simple: Configurar Emails Reales

## 🎯 Objetivo
Hacer que los códigos de verificación lleguen a la bandeja real de los usuarios (no a MailHog).

## ✅ Opción Recomendada: SendGrid (5 minutos)

### Paso 1: Crear cuenta
1. Abre: https://signup.sendgrid.com/
2. Completa el formulario:
   - Email: tu email
   - Contraseña: crea una
   - Nombre: tu nombre
3. Haz clic en "Create Account"
4. Verifica tu email (revisa tu bandeja)

### Paso 2: Crear API Key
1. Una vez dentro de SendGrid, ve a: **Settings** (arriba a la derecha)
2. En el menú lateral, busca: **API Keys**
3. Haz clic en: **"Create API Key"** (botón verde)
4. Dale un nombre: **"UniGO"**
5. Selecciona permisos: **"Full Access"** (o "Mail Send")
6. Haz clic en **"Create & View"**
7. **COPIA LA API KEY** (solo se muestra una vez)
   - Se ve algo como: `SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Paso 3: Configurar en UniGO
Ejecuta:
```bash
cd backend
python3 setup_sendgrid.py
```

Pega la API Key cuando te la pida.

### Paso 4: Reiniciar backend
```bash
make backend
```

## ✅ ¡Listo!

Ahora cuando un usuario se registre:
- El código llegará a SU bandeja real
- No irá a MailHog
- Funciona para todos los usuarios

## ❓ ¿Necesitas ayuda?

Si tienes problemas, dame:
- Tu API Key de SendGrid
- Y yo la configuro por ti

