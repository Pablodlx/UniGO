#!/usr/bin/env python3
"""Configurar SendGrid (más fácil que contraseña de aplicación)"""
import os
from pathlib import Path

print("=" * 70)
print("📧 Configuración de SendGrid (MÁS FÁCIL)")
print("=" * 70)
print()
print("SendGrid es MÁS FÁCIL que contraseña de aplicación:")
print("  ✅ Solo necesitas una API Key (no contraseña compleja)")
print("  ✅ Gratis hasta 100 emails/día")
print("  ✅ Emails reales a bandejas reales")
print()
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print()
print("📋 Pasos:")
print()
print("1. Ve a: https://signup.sendgrid.com/ (crear cuenta gratis)")
print("2. Verifica tu email")
print("3. Ve a Settings → API Keys")
print("4. Crea una nueva API Key (dale un nombre, ej: 'UniGO')")
print("5. Copia la API Key (solo se muestra una vez)")
print()
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print()

api_key = input("🔑 Pega tu API Key de SendGrid: ").strip()

if not api_key:
    print("❌ API Key vacía")
    exit(1)

email_from = input("📧 Email remitente (ej: noreply@tudominio.com o tu-email@gmail.com): ").strip()
if not email_from:
    email_from = "noreply@unigo.com"
    print(f"   Usando: {email_from}")

# Actualizar .env
env_path = Path('.env')
if not env_path.exists():
    print("❌ .env no encontrado")
    exit(1)

with open(env_path, 'r') as f:
    content = f.read()

lines = content.split('\n')
new_lines = []
updated = set()

for line in lines:
    stripped = line.strip()
    if stripped.startswith('EMAIL_BACKEND='):
        new_lines.append('EMAIL_BACKEND=sendgrid\n')
        updated.add('EMAIL_BACKEND')
    elif stripped.startswith('SENDGRID_API_KEY='):
        new_lines.append(f'SENDGRID_API_KEY={api_key}\n')
        updated.add('SENDGRID_API_KEY')
    elif stripped.startswith('EMAIL_FROM='):
        new_lines.append(f'EMAIL_FROM={email_from}\n')
        updated.add('EMAIL_FROM')
    elif stripped.startswith('EMAIL_FROM_NAME='):
        new_lines.append('EMAIL_FROM_NAME=UniGO\n')
        updated.add('EMAIL_FROM_NAME')
    else:
        new_lines.append(line + '\n' if line else '\n')

# Agregar si falta
if 'EMAIL_BACKEND' not in updated:
    new_lines.append('EMAIL_BACKEND=sendgrid\n')
if 'SENDGRID_API_KEY' not in updated:
    new_lines.append(f'SENDGRID_API_KEY={api_key}\n')
if 'EMAIL_FROM' not in updated:
    new_lines.append(f'EMAIL_FROM={email_from}\n')
if 'EMAIL_FROM_NAME' not in updated:
    new_lines.append('EMAIL_FROM_NAME=UniGO\n')

with open(env_path, 'w') as f:
    f.writelines(new_lines)

print()
print("✅ Configuración completada!")
print()
print("📋 Configuración:")
print(f"   EMAIL_BACKEND=sendgrid")
print(f"   SENDGRID_API_KEY={api_key[:10]}...")
print(f"   EMAIL_FROM={email_from}")
print()
print("🔄 Reinicia el backend: make backend")
print()
print("✅ ¡Listo! Los emails llegarán a bandejas reales")
