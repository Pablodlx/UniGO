#!/usr/bin/env python3
"""Script para obtener el código de verificación de un email"""
import sys
import os
from datetime import datetime, UTC

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.auth.models import EmailCode

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://unigo:unigo@localhost:5432/unigo")

def get_verification_code(email: str):
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        # Buscar el código más reciente no consumido
        code_record = (
            db.query(EmailCode)
            .filter(
                EmailCode.email == email,
                EmailCode.purpose == "verify_email",
                EmailCode.consumed.is_(False),
            )
            .order_by(EmailCode.created_at.desc())
            .first()
        )
        
        if not code_record:
            print(f"❌ No se encontró código de verificación pendiente para {email}")
            # Buscar el último código (aunque esté consumido)
            last_code = (
                db.query(EmailCode)
                .filter(EmailCode.email == email)
                .order_by(EmailCode.created_at.desc())
                .first()
            )
            if last_code:
                status = "consumido" if last_code.consumed else "expirado"
                print(f"📋 Último código encontrado (estado: {status}):")
                print(f"   Código: {last_code.code}")
                print(f"   Creado: {last_code.created_at}")
                print(f"   Expira: {last_code.expires_at}")
                if last_code.consumed:
                    print(f"   Consumido: Sí")
                else:
                    now = datetime.now(UTC)
                    if last_code.expires_at < now:
                        print(f"   Expirado: Sí (expiró hace {now - last_code.expires_at})")
                    else:
                        print(f"   Válido hasta: {last_code.expires_at}")
            return None
        
        now = datetime.now(UTC)
        if code_record.expires_at < now:
            print(f"⚠️  Código encontrado pero EXPIRADO:")
            print(f"   Código: {code_record.code}")
            print(f"   Expiró: {code_record.expires_at}")
            print(f"   Hace: {now - code_record.expires_at}")
            return None
        
        print(f"✅ Código de verificación para {email}:")
        print(f"   📝 Código: {code_record.code}")
        print(f"   📅 Creado: {code_record.created_at}")
        print(f"   ⏰ Expira: {code_record.expires_at}")
        print(f"   ⏳ Válido por: {code_record.expires_at - now}")
        print(f"   🔢 Intentos: {code_record.attempts}")
        
        return code_record.code
        
    except Exception as e:
        print(f"❌ Error al consultar la base de datos: {e}")
        return None
    finally:
        db.close()

if __name__ == "__main__":
    email = sys.argv[1] if len(sys.argv) > 1 else "velo@ceu.es"
    get_verification_code(email)

