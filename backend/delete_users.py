#!/usr/bin/env python3
"""Script para eliminar usuarios de la base de datos"""
import sys
import os
from datetime import datetime, timezone

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Try to import psycopg2, if not available, try psycopg2-binary
try:
    import psycopg2
except ImportError:
    try:
        import psycopg2_binary as psycopg2
    except ImportError:
        print("❌ Error: psycopg2 o psycopg2-binary no está instalado")
        print("   Instala con: pip install psycopg2-binary")
        sys.exit(1)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://unigo:unigo@localhost:5432/unigo")

def delete_user_by_email(conn, email: str):
    """Elimina un usuario y todos sus registros relacionados usando SQL directo"""
    cur = conn.cursor()
    
    try:
        # Obtener el ID del usuario
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        result = cur.fetchone()
        
        if not result:
            print(f"❌ Usuario con email {email} no encontrado")
            return False
        
        user_id = result[0]
        print(f"🗑️  Eliminando usuario: {email} (ID: {user_id})")
        
        # 1. Eliminar AlertDriverRejections
        cur.execute("SELECT COUNT(*) FROM alert_driver_rejections WHERE driver_id = %s", (user_id,))
        count = cur.fetchone()[0]
        if count > 0:
            print(f"   - Eliminando {count} rechazos de alertas")
            cur.execute("DELETE FROM alert_driver_rejections WHERE driver_id = %s", (user_id,))
        
        # 2. Eliminar SearchAlerts
        cur.execute("SELECT COUNT(*) FROM search_alerts WHERE user_id = %s", (user_id,))
        count = cur.fetchone()[0]
        if count > 0:
            print(f"   - Eliminando {count} alertas de búsqueda")
            cur.execute("DELETE FROM search_alerts WHERE user_id = %s", (user_id,))
        
        # 3. Eliminar Notifications
        cur.execute("SELECT COUNT(*) FROM notifications WHERE receiver_id = %s", (user_id,))
        count = cur.fetchone()[0]
        if count > 0:
            print(f"   - Eliminando {count} notificaciones")
            cur.execute("DELETE FROM notifications WHERE receiver_id = %s", (user_id,))
        
        # 4. Eliminar Messages (como sender o receiver)
        cur.execute("SELECT COUNT(*) FROM messages WHERE sender_id = %s OR receiver_id = %s", (user_id, user_id))
        count = cur.fetchone()[0]
        if count > 0:
            print(f"   - Eliminando {count} mensajes")
            cur.execute("DELETE FROM messages WHERE sender_id = %s OR receiver_id = %s", (user_id, user_id))
        
        # 5. Eliminar TripGroupMessages
        cur.execute("SELECT COUNT(*) FROM trip_group_messages WHERE sender_id = %s", (user_id,))
        count = cur.fetchone()[0]
        if count > 0:
            print(f"   - Eliminando {count} mensajes de grupo")
            cur.execute("DELETE FROM trip_group_messages WHERE sender_id = %s", (user_id,))
        
        # 6. Eliminar FavoriteRides
        cur.execute("SELECT COUNT(*) FROM favorite_rides WHERE user_id = %s", (user_id,))
        count = cur.fetchone()[0]
        if count > 0:
            print(f"   - Eliminando {count} viajes favoritos")
            cur.execute("DELETE FROM favorite_rides WHERE user_id = %s", (user_id,))
        
        # 7. Eliminar Ratings (dados y recibidos)
        cur.execute("SELECT COUNT(*) FROM ratings WHERE rater_id = %s OR rated_id = %s", (user_id, user_id))
        count = cur.fetchone()[0]
        if count > 0:
            print(f"   - Eliminando {count} valoraciones")
            cur.execute("DELETE FROM ratings WHERE rater_id = %s OR rated_id = %s", (user_id, user_id))
        
        # 8. Obtener bookings del usuario para eliminar payments asociados
        cur.execute("SELECT id FROM bookings WHERE passenger_id = %s", (user_id,))
        booking_ids = [row[0] for row in cur.fetchall()]
        if booking_ids:
            print(f"   - Eliminando {len(booking_ids)} reservas")
            # Eliminar payments asociados
            cur.execute("DELETE FROM payments WHERE booking_id = ANY(%s)", (booking_ids,))
            # Eliminar bookings
            cur.execute("DELETE FROM bookings WHERE passenger_id = %s", (user_id,))
        
        # 9. Obtener rides del usuario como conductor
        cur.execute("SELECT id FROM rides WHERE driver_id = %s", (user_id,))
        ride_ids = [row[0] for row in cur.fetchall()]
        if ride_ids:
            print(f"   - Eliminando {len(ride_ids)} viajes como conductor")
            # Eliminar bookings de estos rides
            cur.execute("SELECT id FROM bookings WHERE ride_id = ANY(%s)", (ride_ids,))
            ride_booking_ids = [row[0] for row in cur.fetchall()]
            if ride_booking_ids:
                cur.execute("DELETE FROM payments WHERE booking_id = ANY(%s)", (ride_booking_ids,))
                cur.execute("DELETE FROM bookings WHERE ride_id = ANY(%s)", (ride_ids,))
            # Eliminar mensajes de grupo de estos rides
            cur.execute("DELETE FROM trip_group_messages WHERE trip_id = ANY(%s)", (ride_ids,))
            # Eliminar mensajes de estos rides
            cur.execute("DELETE FROM messages WHERE trip_id = ANY(%s)", (ride_ids,))
            # Eliminar rides
            cur.execute("DELETE FROM rides WHERE driver_id = %s", (user_id,))
        
        # 10. Eliminar EmailCodes
        cur.execute("SELECT COUNT(*) FROM email_codes WHERE email = %s", (email,))
        count = cur.fetchone()[0]
        if count > 0:
            print(f"   - Eliminando {count} códigos de email")
            cur.execute("DELETE FROM email_codes WHERE email = %s", (email,))
        
        # 11. Eliminar PasswordResetTokens
        cur.execute("SELECT COUNT(*) FROM password_reset_tokens WHERE user_id = %s", (user_id,))
        count = cur.fetchone()[0]
        if count > 0:
            print(f"   - Eliminando {count} tokens de recuperación")
            cur.execute("DELETE FROM password_reset_tokens WHERE user_id = %s", (user_id,))
        
        # 12. Finalmente, eliminar el usuario
        print(f"   - Eliminando usuario...")
        cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
        
        # Commit todos los cambios
        conn.commit()
        print(f"✅ Usuario {email} eliminado correctamente")
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error al eliminar usuario {email}: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        cur.close()

def main():
    emails_to_delete = [
        "jaime.berlangacomas@usp.ceu.es",
        "victor.martinezvillalon@usp.ceu.es"
    ]
    
    # Parse DATABASE_URL
    # Format: postgresql+psycopg2://user:password@host:port/database
    import re
    match = re.match(r'postgresql\+psycopg2://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)', DATABASE_URL)
    if not match:
        print(f"❌ Error: DATABASE_URL no válido: {DATABASE_URL}")
        sys.exit(1)
    
    user, password, host, port, database = match.groups()
    
    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            database=database,
            user=user,
            password=password
        )
        conn.autocommit = False
        
        print("=" * 70)
        print("🗑️  ELIMINACIÓN DE USUARIOS")
        print("=" * 70)
        
        for email in emails_to_delete:
            print()
            delete_user_by_email(conn, email)
            print()
        
        print("=" * 70)
        print("✅ Proceso completado")
        print("=" * 70)
        
    except Exception as e:
        print(f"❌ Error general: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    main()

