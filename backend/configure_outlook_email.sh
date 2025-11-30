#!/bin/bash
# Script para configurar email real con Outlook.com

echo "📧 Configurando email para Outlook.com"
echo ""
echo "Para usar Outlook.com necesitas:"
echo "1. Tu email de Outlook (ej: tuemail@outlook.com o @hotmail.com)"
echo "2. Una contraseña de aplicación (no tu contraseña normal)"
echo ""
echo "Para crear una contraseña de aplicación:"
echo "1. Ve a https://account.microsoft.com/security"
echo "2. Activa la verificación en dos pasos"
echo "3. Ve a 'Contraseñas de aplicación'"
echo "4. Crea una nueva contraseña de aplicación"
echo "5. Cópiala (solo se muestra una vez)"
echo ""

read -p "¿Tu email de Outlook? (ej: tuemail@outlook.com): " OUTLOOK_EMAIL
read -p "¿Contraseña de aplicación de Outlook? (no tu contraseña normal): " OUTLOOK_PASSWORD

if [ -z "$OUTLOOK_EMAIL" ] || [ -z "$OUTLOOK_PASSWORD" ]; then
    echo "❌ Error: Debes proporcionar email y contraseña"
    exit 1
fi

# Detectar si es @outlook.com, @hotmail.com, @live.com, etc.
if [[ "$OUTLOOK_EMAIL" == *"@outlook.com"* ]] || [[ "$OUTLOOK_EMAIL" == *"@hotmail.com"* ]] || [[ "$OUTLOOK_EMAIL" == *"@live.com"* ]]; then
    SMTP_HOST="smtp-mail.outlook.com"
    SMTP_PORT="587"
    SMTP_USE_TLS="true"
    SMTP_USE_SSL="false"
    EMAIL_FROM="$OUTLOOK_EMAIL"
else
    echo "⚠️  Email no parece ser de Outlook.com. Usando configuración genérica."
    SMTP_HOST="smtp-mail.outlook.com"
    SMTP_PORT="587"
    SMTP_USE_TLS="true"
    SMTP_USE_SSL="false"
    EMAIL_FROM="$OUTLOOK_EMAIL"
fi

# Leer el .env actual y actualizar solo las variables de email
cd "$(dirname "$0")"

if [ ! -f .env ]; then
    echo "❌ Error: No se encontró el archivo .env"
    exit 1
fi

# Crear backup
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Actualizar o agregar variables de email
# Primero, comentar las variables de MailHog si existen
sed -i.bak 's/^EMAIL_PROVIDER=MailHog/#EMAIL_PROVIDER=MailHog (deshabilitado)/' .env
sed -i.bak 's/^SMTP_HOST=127.0.0.1/#SMTP_HOST=127.0.0.1 (MailHog deshabilitado)/' .env
sed -i.bak 's/^SMTP_PORT=1025/#SMTP_PORT=1025 (MailHog deshabilitado)/' .env

# Agregar o actualizar variables de Outlook
grep -q "^EMAIL_PROVIDER=" .env && sed -i.bak "s|^EMAIL_PROVIDER=.*|EMAIL_PROVIDER=Outlook.com|" .env || echo "EMAIL_PROVIDER=Outlook.com" >> .env
grep -q "^SMTP_HOST=" .env && sed -i.bak "s|^SMTP_HOST=.*|SMTP_HOST=$SMTP_HOST|" .env || echo "SMTP_HOST=$SMTP_HOST" >> .env
grep -q "^SMTP_PORT=" .env && sed -i.bak "s|^SMTP_PORT=.*|SMTP_PORT=$SMTP_PORT|" .env || echo "SMTP_PORT=$SMTP_PORT" >> .env
grep -q "^SMTP_USERNAME=" .env && sed -i.bak "s|^SMTP_USERNAME=.*|SMTP_USERNAME=$OUTLOOK_EMAIL|" .env || echo "SMTP_USERNAME=$OUTLOOK_EMAIL" >> .env
grep -q "^SMTP_PASSWORD=" .env && sed -i.bak "s|^SMTP_PASSWORD=.*|SMTP_PASSWORD=$OUTLOOK_PASSWORD|" .env || echo "SMTP_PASSWORD=$OUTLOOK_PASSWORD" >> .env
grep -q "^SMTP_USE_TLS=" .env && sed -i.bak "s|^SMTP_USE_TLS=.*|SMTP_USE_TLS=$SMTP_USE_TLS|" .env || echo "SMTP_USE_TLS=$SMTP_USE_TLS" >> .env
grep -q "^SMTP_USE_SSL=" .env && sed -i.bak "s|^SMTP_USE_SSL=.*|SMTP_USE_SSL=$SMTP_USE_SSL|" .env || echo "SMTP_USE_SSL=$SMTP_USE_SSL" >> .env
grep -q "^EMAIL_FROM=" .env && sed -i.bak "s|^EMAIL_FROM=.*|EMAIL_FROM=$EMAIL_FROM|" .env || echo "EMAIL_FROM=$EMAIL_FROM" >> .env
grep -q "^EMAIL_FROM_NAME=" .env && sed -i.bak "s|^EMAIL_FROM_NAME=.*|EMAIL_FROM_NAME=UniGO|" .env || echo "EMAIL_FROM_NAME=UniGO" >> .env

# Limpiar archivos .bak
rm -f .env.bak

echo ""
echo "✅ Configuración actualizada!"
echo ""
echo "📋 Resumen de configuración:"
echo "   Proveedor: Outlook.com"
echo "   SMTP Host: $SMTP_HOST"
echo "   SMTP Port: $SMTP_PORT"
echo "   Email: $OUTLOOK_EMAIL"
echo "   TLS: $SMTP_USE_TLS"
echo ""
echo "⚠️  IMPORTANTE: Reinicia el servidor backend para que los cambios surtan efecto"
echo "   Ejecuta: make backend"
echo ""

