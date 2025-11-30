#!/usr/bin/env python3
"""
Script automático para configurar email SMTP sin pasos manuales
"""
import os
import webbrowser
import subprocess
from pathlib import Path
import sys

def open_browser_to_microsoft():
    """Abre el navegador automáticamente a la página de Microsoft"""
    url = "https://account.microsoft.com/security"
    print(f"🌐 Abriendo navegador a: {url}")
    try:
        webbrowser.open(url)
        return True
    except Exception as e:
        print(f"⚠️  No se pudo abrir el navegador automáticamente: {e}")
        print(f"   Por favor, abre manualmente: {url}")
        return False

def update_env_password(env_path: Path, password: str):
    """Actualiza SMTP_PASSWORD en .env"""
    if not env_path.exists():
        print(f"❌ Archivo .env no encontrado")
        return False
    
    with open(env_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    updated = False
    new_lines = []
    for line in lines:
        if line.strip().startswith('SMTP_PASSWORD='):
            new_lines.append(f'SMTP_PASSWORD={password}\n')
            updated = True
        else:
            new_lines.append(line)
    
    if not updated:
        new_lines.append(f'SMTP_PASSWORD={password}\n')
    
    with open(env_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    return True

def main():
    print("=" * 70)
    print("🚀 Configuración Automática de Email SMTP")
    print("=" * 70)
    print()
    
    env_path = Path('.env')
    if not env_path.exists():
        print("❌ No se encontró el archivo .env")
        print("   Por favor, ejecuta esto desde el directorio backend/")
        return
    
    # Verificar si ya está configurado
    with open(env_path, 'r') as f:
        env_content = f.read()
    
    if 'SMTP_PASSWORD=' in env_content:
        current_password = None
        for line in env_content.split('\n'):
            if line.strip().startswith('SMTP_PASSWORD='):
                current_password = line.split('=', 1)[1].strip()
                break
        
        if current_password and current_password != 'TU_CONTRASEÑA_DE_APLICACION_AQUI' and len(current_password) > 10:
            print("✅ La contraseña SMTP ya está configurada")
            print()
            print("¿Quieres cambiarla? (s/n): ", end='')
            respuesta = input().strip().lower()
            if respuesta != 's':
                print("✅ Configuración actual mantenida")
                return
    
    # Verificar EMAIL_BACKEND
    if 'EMAIL_BACKEND=smtp' not in env_content:
        print("⚠️  EMAIL_BACKEND no está configurado como 'smtp'")
        print("   Configurando automáticamente...")
        # Actualizar EMAIL_BACKEND
        lines = env_content.split('\n')
        new_lines = []
        found = False
        for line in lines:
            if line.strip().startswith('EMAIL_BACKEND='):
                new_lines.append('EMAIL_BACKEND=smtp\n')
                found = True
            else:
                new_lines.append(line + '\n' if line else '\n')
        if not found:
            new_lines.insert(0, 'EMAIL_BACKEND=smtp\n')
        
        with open(env_path, 'w') as f:
            f.writelines(new_lines)
        print("✅ EMAIL_BACKEND configurado")
    
    print()
    print("📋 Pasos automáticos:")
    print("   1. Abrir navegador a Microsoft Security")
    print("   2. Crear contraseña de aplicación")
    print("   3. Copiar y pegar aquí")
    print()
    
    # Abrir navegador automáticamente
    open_browser_to_microsoft()
    
    print()
    print("📝 Instrucciones:")
    print("   1. En la página que se abrió, activa 'Verificación en dos pasos' (si no está activada)")
    print("   2. Busca 'Contraseñas de aplicación' o 'App passwords'")
    print("   3. Crea una nueva contraseña de aplicación para 'Correo' o 'Mail'")
    print("   4. Cópiala (tiene formato: abcd efgh ijkl mnop)")
    print()
    
    # Pedir la contraseña
    while True:
        password = input("🔑 Pega aquí tu contraseña de aplicación (o 'q' para salir): ").strip()
        
        if password.lower() == 'q':
            print("❌ Configuración cancelada")
            return
        
        if not password:
            print("⚠️  La contraseña no puede estar vacía")
            continue
        
        # Validar formato básico (debe tener al menos 10 caracteres)
        if len(password) < 10:
            print("⚠️  La contraseña parece muy corta. ¿Estás seguro? (s/n): ", end='')
            confirm = input().strip().lower()
            if confirm != 's':
                continue
        
        # Confirmar
        print()
        print(f"📧 Contraseña recibida: {'*' * min(len(password), 20)}")
        print("¿Confirmar y guardar? (s/n): ", end='')
        confirm = input().strip().lower()
        
        if confirm == 's':
            # Guardar contraseña
            if update_env_password(env_path, password):
                print()
                print("✅ ¡Configuración completada automáticamente!")
                print()
                print("📋 Resumen:")
                print("   ✅ EMAIL_BACKEND=smtp")
                print("   ✅ SMTP_PASSWORD configurada")
                print()
                print("🔄 Próximo paso:")
                print("   Reinicia el backend para aplicar los cambios:")
                print("   - Si usas 'make backend': Ctrl+C y luego 'make backend'")
                print("   - O reinicia el proceso manualmente")
                print()
                print("✅ ¡Listo! Ahora todos los usuarios recibirán emails reales")
                return
            else:
                print("❌ Error al guardar la contraseña")
        else:
            print("🔄 Intenta de nuevo...")
            print()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Configuración cancelada")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

