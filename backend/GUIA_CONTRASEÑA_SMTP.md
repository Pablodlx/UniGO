# 🔑 Guía: Contraseña SMTP (Contraseña de Aplicación)

## ¿Qué es?

La **contraseña SMTP** (también llamada "Contraseña de aplicación") es una contraseña especial que Microsoft te da para que las aplicaciones puedan enviar emails desde tu cuenta de Outlook.

## ⚠️ IMPORTANTE

- **NO es tu contraseña normal** de Outlook
- Es una contraseña **especial** que Microsoft genera para ti
- Solo se muestra **una vez** cuando la creas
- Es **segura**: si alguien la roba, solo puede enviar emails, no acceder a tu cuenta

## 📋 Cómo obtenerla (3 pasos simples)

### Paso 1: Ir a Microsoft Security
Ve a: **https://account.microsoft.com/security**

### Paso 2: Activar verificación en dos pasos
- Si ya está activada, salta al paso 3
- Si no, actívala (es necesario para crear contraseñas de aplicación)

### Paso 3: Crear contraseña de aplicación
1. Busca **"Contraseñas de aplicación"** o **"App passwords"**
2. Haz clic en **"Crear nueva contraseña de aplicación"**
3. Elige **"Correo"** o **"Mail"** como aplicación
4. Microsoft te dará una contraseña como: `abcd efgh ijkl mnop`
5. **Cópiala inmediatamente** (solo se muestra una vez)

## 🚀 Configurar en UniGO

Una vez que tengas la contraseña:

```bash
cd backend
python3 setup_email_auto.py
```

O manualmente, edita `backend/.env` y cambia:
```
SMTP_PASSWORD=TU_CONTRASEÑA_DE_APLICACION_AQUI
```

Por:
```
SMTP_PASSWORD=abcd-efgh-ijkl-mnop
```
(Sin espacios, puedes usar guiones o sin guiones)

## ✅ Verificación

Después de configurar, reinicia el backend:
```bash
make backend
```

¡Listo! Ahora los emails llegarán a la bandeja real de los usuarios.

## 💡 Ejemplo visual

```
Tu cuenta Outlook: santiago@outlook.com
Tu contraseña normal: ******** (NO usar esta)
Contraseña de aplicación: abcd-efgh-ijkl-mnop (USAR ESTA)
```

## ❓ Preguntas frecuentes

**P: ¿Puedo usar mi contraseña normal?**
R: No, Microsoft no lo permite por seguridad.

**P: ¿Qué pasa si pierdo la contraseña de aplicación?**
R: Crea una nueva en Microsoft Security y actualiza `.env`

**P: ¿Es segura?**
R: Sí, solo permite enviar emails, no acceder a tu cuenta.

**P: ¿Funciona para todos los usuarios?**
R: Sí, una vez configurada, todos los usuarios recibirán emails reales.

