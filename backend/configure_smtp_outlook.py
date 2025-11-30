#!/usr/bin/env python3
"""
Script para configurar SMTP de Outlook.com en UniGO
"""
import os
import re
from pathlib import Path

def update_env_file(env_path: Path, updates: dict):
    """Update or add variables in .env file"""
    if not env_path.exists():
        print(f"❌ Archivo .env no encontrado en {env_path}")
        return False
    
    # Read current content
    with open(env_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Create a set of keys to update
    keys_to_update = set(updates.keys())
    updated_lines = []
    updated_keys = set()
    
    # Process existing lines
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            updated_lines.append(line)
            continue
        
        # Check if this line contains a key we need to update
        for key in keys_to_update:
            if stripped.startswith(f'{key}='):
                updated_lines.append(f'{key}={updates[key]}\n')
                updated_keys.add(key)
                break
        else:
            updated_lines.append(line)
    
    # Add missing keys at the end
    for key, value in updates.items():
        if key not in updated_keys:
            updated_lines.append(f'{key}={value}\n')
    
    # Write back
    with open(env_path, 'w', encoding='utf-8') as f:
        f.writelines(updated_lines)
    
    return True

def main():
    print("=" * 60)
    print("📧 Configuración de SMTP para Outlook.com")
    print("=" * 60)
    print()
    print("Para usar Outlook.com necesitas:")
    print("1. Tu email de Outlook (ej: tuemail@outlook.com)")
    print("2. Una contraseña de aplicación (NO tu contraseña normal)")
    print()
    print("Para crear una contraseña de aplicación:")
    print("1. Ve a: https://account.microsoft.com/security")
    print("2. Activa la verificación en dos pasos (si no está activada)")
    print("3. Ve a 'Contraseñas de aplicación' o 'App passwords'")
    print("4. Crea una nueva contraseña de aplicación para 'Correo'")
    print("5. Cópiala (solo se muestra una vez)")
    print()
    
    # Get email
    while True:
        email = input("📧 Tu email de Outlook (ej: tuemail@outlook.com): ").strip()
        if '@' in email and (email.endswith('@outlook.com') or email.endswith('@hotmail.com') or email.endswith('@live.com')):
            break
        print("❌ Por favor, ingresa un email válido de Outlook (@outlook.com, @hotmail.com, o @live.com)")
    
    # Get app password
    print()
    print("⚠️  IMPORTANTE: Necesitas una contraseña de aplicación, NO tu contraseña normal")
    app_password = input("🔑 Contraseña de aplicación de Outlook: ").strip()
    
    if not app_password:
        print("❌ La contraseña de aplicación es requerida")
        return
    
    # Determine SMTP host based on email domain
    if '@outlook.com' in email or '@hotmail.com' in email or '@live.com' in email:
        smtp_host = "smtp-mail.outlook.com"
    else:
        smtp_host = "smtp-mail.outlook.com"
        print(f"⚠️  Usando smtp-mail.outlook.com por defecto")
    
    # Configuration updates
    updates = {
        'EMAIL_BACKEND': 'smtp',
        'EMAIL_PROVIDER': 'Outlook.com',
        'SMTP_HOST': smtp_host,
        'SMTP_PORT': '587',
        'SMTP_USERNAME': email,
        'SMTP_PASSWORD': app_password,
        'SMTP_USE_TLS': 'true',
        'SMTP_USE_SSL': 'false',
        'EMAIL_FROM_NAME': 'UniGO',
        'EMAIL_FROM': email,
    }
    
    # Find .env file
    backend_dir = Path(__file__).parent
    env_path = backend_dir / '.env'
    
    if not env_path.exists():
        print(f"❌ No se encontró el archivo .env en {env_path}")
        print(f"   Por favor, crea el archivo .env primero")
        return
    
    # Backup
    backup_path = backend_dir / f'.env.backup.{os.urandom(4).hex()}'
    import shutil
    shutil.copy(env_path, backup_path)
    print(f"✅ Backup creado: {backup_path.name}")
    
    # Update .env
    if update_env_file(env_path, updates):
        print()
        print("✅ Configuración actualizada correctamente!")
        print()
        print("📋 Resumen de configuración:")
        print(f"   EMAIL_BACKEND: smtp")
        print(f"   EMAIL_PROVIDER: Outlook.com")
        print(f"   SMTP_HOST: {smtp_host}")
        print(f"   SMTP_PORT: 587")
        print(f"   SMTP_USERNAME: {email}")
        print(f"   SMTP_USE_TLS: true")
        print(f"   EMAIL_FROM: {email}")
        print()
        print("⚠️  IMPORTANTE: Reinicia el servidor backend para que los cambios surtan efecto")
        print("   Ejecuta: make backend")
        print("   O reinicia el proceso del backend manualmente")
        print()
    else:
        print("❌ Error al actualizar el archivo .env")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Configuración cancelada")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

