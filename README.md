# 🎓 UniGO

<div align="center">

**UniGO** es una plataforma completa de carpooling universitario que conecta estudiantes para compartir viajes de manera segura, económica y sostenible.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.114.1-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15.5.4-000000?style=flat&logo=next.js)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.13+-3776AB?style=flat&logo=python)](https://www.python.org/)

</div>

---

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Stack Tecnológico](#-stack-tecnológico)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación Rápida](#-instalación-rápida)
- [Configuración](#-configuración)
- [Uso](#-uso)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Desarrollo](#-desarrollo)
- [API Documentation](#-api-documentation)
- [Contribuir](#-contribuir)
- [Licencia](#-licencia)

---

## ✨ Características

### 🔐 Autenticación y Seguridad
- ✅ Registro con email institucional universitario
- ✅ Verificación de email mediante código de 6 dígitos
- ✅ Autenticación JWT con tokens de acceso
- ✅ Recuperación de contraseña segura
- ✅ Validación de dominios universitarios españoles

### 🚗 Gestión de Viajes
- ✅ Publicación de viajes por conductores
- ✅ Búsqueda avanzada de viajes (origen, destino, fecha)
- ✅ Búsqueda de viajes cercanos (radio configurable)
- ✅ Sistema de reservas con estados (pendiente, confirmada, rechazada, cancelada)
- ✅ Alertas automáticas de búsqueda de viajes
- ✅ Viajes favoritos para acceso rápido

### 💬 Comunicación
- ✅ Chat privado entre conductor y pasajero
- ✅ Mensajes grupales para viajes confirmados
- ✅ Notificaciones en tiempo real (WebSocket)
- ✅ Sistema de notificaciones push

### ⭐ Sistema de Valoraciones
- ✅ Valoraciones mutuas entre conductores y pasajeros
- ✅ Sistema de comentarios
- ✅ Historial de viajes completados

### 💳 Pagos
- ✅ Integración con Stripe para pagos seguros
- ✅ Gestión de métodos de pago
- ✅ Sistema de comisiones configurable

### 📊 Observabilidad
- ✅ Métricas de Prometheus
- ✅ Dashboards de Grafana
- ✅ Logging estructurado

---

## 🛠 Stack Tecnológico

### Backend
- **Framework:** FastAPI 0.114.1
- **Lenguaje:** Python 3.13+
- **Base de Datos:** PostgreSQL 16
- **ORM:** SQLAlchemy 2.0
- **Migraciones:** Alembic
- **Autenticación:** JWT (python-jose)
- **Validación:** Pydantic 2.11
- **Email:** Mailjet / SendGrid / SMTP
- **Pagos:** Stripe API

### Frontend
- **Framework:** Next.js 15.5.4
- **Lenguaje:** TypeScript 5.x
- **Estilos:** Tailwind CSS 4
- **Mapas:** Google Maps API
- **Formularios:** React Hook Form + Zod
- **HTTP Client:** Axios

### Infraestructura
- **Contenedores:** Docker & Docker Compose
- **Base de Datos:** PostgreSQL
- **Email Development:** MailHog
- **Monitoreo:** Prometheus + Grafana

---

## 🧰 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- **Docker Desktop** con Docker Compose (en Windows, activa integración WSL2)
- **Python 3.13+**
- **Node.js 18+** y **npm**
- **Git**

---

## 🚀 Instalación Rápida

### 1. Clonar el Repositorio

```bash
git clone https://github.com/Pablodlx/UniGO.git
cd UniGO
```

### 2. Iniciar Infraestructura

Levanta los servicios necesarios (PostgreSQL, MailHog, Prometheus, Grafana):

```bash
make infra-up
```

### 3. Configurar Backend

Instala dependencias y crea el entorno virtual:

```bash
make backend-setup
```

### 4. Configurar Variables de Entorno

Crea el archivo `.env` en el directorio `backend/`:

```bash
cd backend
cp .env.example .env  # Si existe un ejemplo
nano .env              # O crea el archivo manualmente
```

**Plantilla mínima de configuración:**

```env
# Seguridad
SECRET_KEY=tu-clave-secreta-super-segura-cambia-esto

# Base de Datos
DATABASE_URL=postgresql+psycopg2://unigo:unigo@localhost:5432/unigo

# JWT
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Email (Desarrollo con MailHog)
EMAIL_BACKEND=mailhog
SMTP_HOST=127.0.0.1
SMTP_PORT=1025

# Email (Producción - Mailjet)
# EMAIL_BACKEND=mailjet
# MAILJET_API_KEY=tu-api-key
# MAILJET_SECRET_KEY=tu-secret-key
# EMAIL_FROM=noreply@tudominio.com
# EMAIL_FROM_NAME=UniGO

# Dominios universitarios permitidos
ALLOWED_EMAIL_DOMAINS=ugr.es,us.es,uma.es,ucm.es,upm.es,uab.cat,ub.edu,uoc.edu

# Stripe (Opcional)
# STRIPE_SECRET_KEY=sk_test_xxx
# STRIPE_PUBLIC_KEY=pk_test_xxx
# STRIPE_WEBHOOK_SECRET=whsec_xxx
# APP_COMMISSION_PERCENT=15
```

**Vuelve al directorio raíz:**

```bash
cd ..
```

### 5. Ejecutar Migraciones

```bash
make migrate
```

### 6. Iniciar Backend

```bash
make backend
```

El backend estará disponible en: http://127.0.0.1:8000

### 7. Configurar Frontend

En otra terminal, instala dependencias del frontend:

```bash
make frontend-setup
```

Crea el archivo `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000/api
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu-google-maps-api-key
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_xxx  # Opcional
```

### 8. Iniciar Frontend

```bash
make frontend
```

El frontend estará disponible en: http://127.0.0.1:3001

---

## 🔌 URLs y Puertos

| Servicio | URL | Descripción |
|----------|-----|-------------|
| **Frontend** | http://127.0.0.1:3001 | Aplicación web Next.js |
| **Backend API** | http://127.0.0.1:8000 | API REST FastAPI |
| **Swagger Docs** | http://127.0.0.1:8000/docs | Documentación interactiva |
| **Métricas** | http://127.0.0.1:8000/metrics | Endpoint Prometheus |
| **MailHog UI** | http://127.0.0.1:8025 | Interfaz de emails de desarrollo |
| **Prometheus** | http://127.0.0.1:9090 | Servidor de métricas |
| **Grafana** | http://127.0.0.1:3000 | Dashboards (admin/admin) |
| **PostgreSQL** | localhost:5432 | Base de datos (user: `unigo`, pass: `unigo`) |

> **Nota:** El frontend usa el puerto 3001 porque Grafana ocupa el 3000.

---

## ⚙️ Configuración Detallada

### Configuración de Email

#### Desarrollo (MailHog)
```env
EMAIL_BACKEND=mailhog
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
```

#### Producción (Mailjet - Recomendado)
```env
EMAIL_BACKEND=mailjet
MAILJET_API_KEY=tu-api-key
MAILJET_SECRET_KEY=tu-secret-key
EMAIL_FROM=noreply@tudominio.com
EMAIL_FROM_NAME=UniGO
```

#### Producción (SendGrid)
```env
EMAIL_BACKEND=sendgrid
SENDGRID_API_KEY=tu-api-key
EMAIL_FROM=noreply@tudominio.com
EMAIL_FROM_NAME=UniGO
```

#### Producción (SMTP Genérico)
```env
EMAIL_BACKEND=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=tu-email@gmail.com
SMTP_PASSWORD=tu-app-password
SMTP_USE_TLS=true
EMAIL_FROM=tu-email@gmail.com
EMAIL_FROM_NAME=UniGO
```

### Configuración de Google Maps

1. Obtén una API Key en [Google Cloud Console](https://console.cloud.google.com/)
2. Habilita las APIs: Maps JavaScript API, Places API, Geocoding API
3. Añade la key en `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu-api-key
   ```

### Configuración de Stripe

1. Crea una cuenta en [Stripe](https://stripe.com/)
2. Obtén tus API keys (modo test para desarrollo)
3. Configura en `backend/.env`:
   ```env
   STRIPE_SECRET_KEY=sk_test_xxx
   STRIPE_PUBLIC_KEY=pk_test_xxx
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   APP_COMMISSION_PERCENT=15
   ```
4. Configura en `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_xxx
   ```

---

## 📖 Uso

### Comandos Makefile Principales

```bash
# Infraestructura
make infra-up          # Levantar servicios (Postgres, MailHog, etc.)
make infra-down        # Detener servicios
make infra-logs        # Ver logs de infraestructura

# Backend
make backend-setup     # Instalar dependencias
make backend           # Iniciar servidor de desarrollo
make migrate           # Ejecutar migraciones de base de datos
make revision MSG="descripción"  # Crear nueva migración

# Frontend
make frontend-setup    # Instalar dependencias
make frontend          # Iniciar servidor de desarrollo

# Calidad de código
make lint              # Ejecutar linter
make fmt               # Formatear código
make test              # Ejecutar tests

# Utilidades
make urls              # Mostrar todas las URLs disponibles
make start-all         # Iniciar todo (infra + backend + frontend)
```

### Flujo de Usuario Típico

1. **Registro:** El usuario se registra con su email institucional
2. **Verificación:** Recibe un código de verificación por email
3. **Perfil:** Completa su perfil (universidad, carrera, dirección)
4. **Publicar/Buscar:** Como conductor publica viajes o como pasajero busca viajes
5. **Reserva:** El pasajero solicita una reserva
6. **Confirmación:** El conductor acepta o rechaza
7. **Comunicación:** Chatean antes del viaje
8. **Viaje:** Completan el viaje
9. **Valoración:** Se valoran mutuamente

---

## 📁 Estructura del Proyecto

```
UniGO/
├── backend/                 # Backend FastAPI
│   ├── app/
│   │   ├── auth/           # Autenticación y autorización
│   │   ├── rides/          # Gestión de viajes
│   │   ├── bookings/       # Sistema de reservas
│   │   ├── chat/           # Chat privado
│   │   ├── trip_chat/      # Chat grupal de viajes
│   │   ├── ratings/        # Sistema de valoraciones
│   │   ├── payments/       # Integración Stripe
│   │   ├── profile/        # Perfiles de usuario
│   │   ├── notifications/  # Sistema de notificaciones
│   │   ├── search_alerts/  # Alertas de búsqueda
│   │   ├── users/          # Gestión de usuarios
│   │   ├── core/           # Configuración y utilidades
│   │   └── db/             # Configuración de base de datos
│   ├── alembic/            # Migraciones de base de datos
│   ├── requirements.txt    # Dependencias Python
│   └── .env               # Variables de entorno
│
├── frontend/               # Frontend Next.js
│   ├── src/
│   │   ├── app/           # Rutas y páginas
│   │   ├── components/    # Componentes React
│   │   └── lib/           # Utilidades y API client
│   ├── public/            # Archivos estáticos
│   ├── package.json       # Dependencias Node
│   └── .env.local        # Variables de entorno
│
├── infra/                  # Infraestructura Docker
│   └── docker-compose.yml # Configuración de servicios
│
├── Makefile               # Comandos de automatización
└── README.md             # Este archivo
```

---

## 🔧 Desarrollo

### Crear una Nueva Migración

```bash
make revision MSG="descripción de la migración"
```

### Ejecutar Tests

```bash
make test
```

### Verificar Calidad de Código

```bash
make lint  # Verificar sin cambios
make fmt   # Formatear automáticamente
```

### Acceder a la Base de Datos

```bash
# Conectar a PostgreSQL
docker exec -it unigo-postgres psql -U unigo -d unigo
```

### Ver Logs

```bash
# Logs de infraestructura
make infra-logs

# Logs del backend (en la terminal donde corre)
# Logs del frontend (en la terminal donde corre)
```

---

## 📚 API Documentation

La documentación interactiva de la API está disponible en:

- **Swagger UI:** http://127.0.0.1:8000/docs
- **ReDoc:** http://127.0.0.1:8000/redoc

### Autenticación

La mayoría de endpoints requieren autenticación JWT. Incluye el token en el header:

```
Authorization: Bearer <tu-token>
```

### Endpoints Principales

- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/verify` - Verificar código de email
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/rides/search` - Buscar viajes
- `POST /api/rides` - Crear viaje
- `POST /api/bookings` - Crear reserva
- `GET /api/chat/messages` - Obtener mensajes
- `POST /api/chat/send` - Enviar mensaje

---

## 📊 Observabilidad

### Prometheus

Las métricas están disponibles en: http://127.0.0.1:8000/metrics

### Grafana

1. Accede a http://127.0.0.1:3000
2. Login: `admin` / `admin` (cambiar en primer acceso)
3. Añade Prometheus como data source:
   - URL: `http://prometheus:9090` (si Grafana está en Docker)
   - O: `http://127.0.0.1:9090` (si Grafana está fuera de Docker)

### Logs Estructurados

Los logs incluyen timestamps, niveles y contexto. Busca en las salidas de las terminales del backend.

---

## 🛑 Detener Servicios

Para detener todos los servicios y limpiar volúmenes:

```bash
make infra-down
```

Esto detendrá y eliminará todos los contenedores Docker.

---

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Estándares de Código

- Usa `make fmt` antes de commitear
- Ejecuta `make lint` y corrige errores
- Escribe tests para nuevas funcionalidades
- Documenta código complejo

---

## 📝 Licencia

Este proyecto es propiedad de **Equipo UniGO - 2025**.

---

## 👥 Equipo

**Equipo UniGO - 2025**

---

## 🆘 Soporte

Si encuentras algún problema:

1. Revisa la documentación
2. Verifica los logs (`make infra-logs`)
3. Abre un issue en GitHub con detalles del error

---

<div align="center">

**Construido con ❤️ para la comunidad universitaria**

🎓 **UniGO** - Carpooling universitario inteligente

</div>
