#!/usr/bin/env python3
"""
Script para configurar Mailtrap automáticamente.
Mailtrap es un servicio de email de desarrollo que no requiere verificación.
"""

import os
from pathlib import Path

def setup_mailtrap():
    print("=" * 70)
    print("📧 CONFIGURACIÓN DE MAILTRAP")
    print("=" * 70)
    print()
    print("Mailtrap es perfecto para desarrollo:")
    print("  ✅ No requiere verificación de dominio")
    print("  ✅ No usa tu email personal")
    print("  ✅ Los emails van a una bandeja de prueba")
    print("  ✅ Gratis para desarrollo")
    print()
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print()
    print("📋 PASOS:")
    print()
    print("  1. Ve a: https://mailtrap.io/")
    print("  2. Crea cuenta gratuita (o inicia sesión)")
    print("  3. Ve a: Email Testing → Inboxes")
    print("  4. Crea un inbox nuevo (o usa el que ya tienes)")
    print("  5. Haz clic en el inbox")
    print("  6. Ve a la pestaña 'SMTP Settings'")
    print("  7. Selecciona 'Integrations' → 'SMTP'")
    print("  8. Copia las credenciales:")
    print("     - Host: smtp.mailtrap.io")
    print("     - Port: 2525")
    print("     - Username: (te lo da Mailtrap)")
    print("     - Password: (te lo da Mailtrap)")
    print()
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print()
    
    # Pedir credenciales
    username = input("📧 Username de Mailtrap: ").strip()
    password = input("🔑 Password de Mailtrap: ").strip()
    
    if not username or not password:
        print()
        print("❌ Error: Username y Password son requeridos")
        return
    
    # Leer .env
    env_path = Path('.env')
    if not env_path.exists():
        print(f"❌ Error: No se encuentra .env en {env_path.absolute()}")
        return
    
    with open(env_path, 'r') as f:
        content = f.read()
    
    # Actualizar variables
    lines = content.split('\n')
    new_lines = []
    updated = {
        'EMAIL_BACKEND': False,
        'SMTP_HOST': False,
        'SMTP_PORT': False,
        'SMTP_USERNAME': False,
        'SMTP_PASSWORD': False,
        'EMAIL_FROM': False,
    }
    
    for line in lines:
        if line.strip().startswith('EMAIL_BACKEND='):
            new_lines.append('EMAIL_BACKEND=smtp\n')
            updated['EMAIL_BACKEND'] = True
        elif line.strip().startswith('SMTP_HOST='):
            new_lines.append('SMTP_HOST=smtp.mailtrap.io\n')
            updated['SMTP_HOST'] = True
        elif line.strip().startswith('SMTP_PORT='):
            new_lines.append('SMTP_PORT=2525\n')
            updated['SMTP_PORT'] = True
        elif line.strip().startswith('SMTP_USERNAME='):
            new_lines.append(f'SMTP_USERNAME={username}\n')
            updated['SMTP_USERNAME'] = True
        elif line.strip().startswith('SMTP_PASSWORD='):
            new_lines.append(f'SMTP_PASSWORD={password}\n')
            updated['SMTP_PASSWORD'] = True
        elif line.strip().startswith('EMAIL_FROM='):
            new_lines.append('EMAIL_FROM=noreply@unigo.com\n')
            updated['EMAIL_FROM'] = True
        else:
            new_lines.append(line + '\n' if line else '\n')
    
    # Añadir variables faltantes
    if not updated['EMAIL_BACKEND']:
        new_lines.append('EMAIL_BACKEND=smtp\n')
    if not updated['SMTP_HOST']:
        new_lines.append('SMTP_HOST=smtp.mailtrap.io\n')
    if not updated['SMTP_PORT']:
        new_lines.append('SMTP_PORT=2525\n')
    if not updated['SMTP_USERNAME']:
        new_lines.append(f'SMTP_USERNAME={username}\n')
    if not updated['SMTP_PASSWORD']:
        new_lines.append(f'SMTP_PASSWORD={password}\n')
    if not updated['EMAIL_FROM']:
        new_lines.append('EMAIL_FROM=noreply@unigo.com\n')
    
    # Escribir .env
    with open(env_path, 'w') as f:
        f.writelines(new_lines)
    
    print()
    print("=" * 70)
    print("✅ CONFIGURACIÓN COMPLETA")
    print("=" * 70)
    print()
    print("📧 Configuración aplicada:")
    print("   EMAIL_BACKEND=smtp")
    print("   SMTP_HOST=smtp.mailtrap.io")
    print("   SMTP_PORT=2525")
    print(f"   SMTP_USERNAME={username}")
    print("   SMTP_PASSWORD=***")
    print("   EMAIL_FROM=noreply@unigo.com")
    print()
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print()
    print("✅ PRÓXIMOS PASOS:")
    print()
    print("   1. Reinicia el backend: make backend")
    print("   2. Prueba registrando un usuario")
    print("   3. Ve a Mailtrap → Inbox para ver el email")
    print()
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print()
    print("💡 VENTAJAS:")
    print()
    print("   - Los emails NO salen de tu email personal ✅")
    print("   - Los emails van a Mailtrap (bandeja de prueba) ✅")
    print("   - Puedes ver todos los emails enviados ✅")
    print("   - No requiere verificación de dominio ✅")
    print()
    print("=" * 70)

if __name__ == "__main__":
    setup_mailtrap()

