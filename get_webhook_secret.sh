#!/bin/bash

# Script para obtener el webhook secret de Stripe
echo "🔍 Iniciando Stripe webhook listener..."
echo ""

# Ejecutar stripe listen y capturar las primeras líneas donde aparece el secret
stripe listen --forward-to http://127.0.0.1:8000/api/payments/webhook 2>&1 | while IFS= read -r line; do
    echo "$line"
    
    # Buscar la línea que contiene el webhook secret
    if echo "$line" | grep -q "webhook signing secret is"; then
        # Extraer el secret
        WEBHOOK_SECRET=$(echo "$line" | grep -o "whsec_[^ ]*" | head -1)
        if [ ! -z "$WEBHOOK_SECRET" ]; then
            echo ""
            echo "✅ WEBHOOK SECRET ENCONTRADO:"
            echo "$WEBHOOK_SECRET"
            echo ""
            echo "📝 Guardando en archivo temporal..."
            echo "$WEBHOOK_SECRET" > /tmp/stripe_webhook_secret.txt
            echo "✅ Secret guardado en /tmp/stripe_webhook_secret.txt"
            echo ""
            echo "⚠️  El listener sigue corriendo. Presiona Ctrl+C para detenerlo."
        fi
    fi
done

