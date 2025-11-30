# 📧 Configuración Automática de Email

## 🚀 Configuración en 1 paso

Ejecuta este comando y sigue las instrucciones:

```bash
cd backend
python3 setup_email_auto.py
```

El script:
- ✅ Abre automáticamente el navegador a Microsoft
- ✅ Te guía paso a paso
- ✅ Configura todo automáticamente
- ✅ No necesitas editar archivos manualmente

## 📋 O si prefieres hacerlo manualmente:

1. Ve a: https://account.microsoft.com/security
2. Activa "Verificación en dos pasos"
3. Ve a "Contraseñas de aplicación"
4. Crea una nueva para "Correo"
5. Ejecuta: `python3 setup_email_simple.py`
6. Pega la contraseña cuando te la pida

## ✅ Verificación

Después de configurar, reinicia el backend:

```bash
make backend
```

¡Listo! Todos los usuarios recibirán emails reales en su bandeja de entrada.

