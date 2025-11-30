#!/usr/bin/env python3
"""Script ultra-simple para configurar SMTP"""
import os
from pathlib import Path

env = Path(".env")
if not env.exists():
    print("❌ .env no encontrado")
    exit(1)

# Leer
with open(env, "r") as f:
    content = f.read()

# Pedir contraseña
print("🔑 Pega tu contraseña de aplicación de Outlook:")
password = input().strip()

if not password:
    print("❌ Contraseña vacía")
    exit(1)

# Actualizar
lines = content.split("\n")
new_lines = []
for line in lines:
    if line.startswith("SMTP_PASSWORD="):
        new_lines.append(f"SMTP_PASSWORD={password}\n")
    else:
        new_lines.append(line + "\n")

with open(env, "w") as f:
    f.writelines(new_lines)

print("✅ Configurado! Reinicia el backend.")
