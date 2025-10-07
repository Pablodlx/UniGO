

# 🎓 UniGo

**UniGo** es una aplicación fullstack (FastAPI + React) para carpooling universitario.  
Incluye registro con email institucional, verificación por código (correo vía MailHog en desarrollo) e inicio de sesión con JWT.  
Infra con Postgres, Prometheus y Grafana para observabilidad.

---

## 🔌 Puertos y URLs (por defecto)

- **Backend (FastAPI):** http://127.0.0.1:8000  
  - Swagger: http://127.0.0.1:8000/docs  
  - Métricas (Prometheus): http://127.0.0.1:8000/metrics
- **Frontend (Vite dev):** http://127.0.0.1:3001
- **Postgres:** localhost:5432  (DB: `unigo`, user: `unigo`, pass: `unigo`)
- **MailHog (dev email):** UI http://127.0.0.1:8025 · SMTP 127.0.0.1:1025
- **Prometheus:** http://127.0.0.1:9090
- **Grafana:** http://127.0.0.1:3000

> **Nota:** Movemos el frontend al **3001** porque Grafana usa el **3000**.

---

## 🧰 Requisitos previos

- **Docker Desktop** + **docker compose** (en Windows, activa integración WSL con tu distro).
- **Python 3.12+**
- **Node.js 18+** y **npm**
- **Git**

---

# 🚀 Puesta en marcha de la aplicación.

## Clonar el repo:

`git clone https://github.com/Pablodlx/UniGo.git` 

## Infraestructura (Postgres, MailHog, Prometheus, Grafana)

`make infra-up`

## Backend (crea venv e instala dependencias)
`make backend-setup`

## Config .env (backend)
`cd backend`

`nano .env`

**Usar esta plantilla:**

SECRET_KEY=super-secret-cambia-esto

ACCESS_TOKEN_EXPIRE_MINUTES=60

DATABASE_URL=postgresql+psycopg2://unigo:unigo@localhost:5432/unigo

EMAIL_CODE_EXPIRE_MINUTES=15

MAIL_USERNAME=

MAIL_PASSWORD=

MAIL_FROM=unigo@soporte.com

MAIL_PORT=1025

MAIL_SERVER=127.0.0.1

MAIL_STARTTLS=False

MAIL_SSL_TLS=False

ALLOWED_EMAIL_DOMAINS=ugr.es, us.es, uma.es, ucm.es, upm.es, uab.cat, ub.edu, uoc.edu, upc.edu, upf.edu, ehu.eus, unizar.es, upna.es, uva.es, uclm.es, uniovi.es, unileon.es, unican.es, uib.es, ulpgc.es, um.es, upct.es, uex.es

`cd ..`

## Migraciones
`make migrate`

## Levantar backend 
`make backend`

## Frontend
`make frontend-setup`

`make frontend`

Frontend dev: http://127.0.0.1:3001

Configurable con frontend/.env:

VITE_API_BASE=http://127.0.0.1:8000

## 📊 Observabilidad

Prometheus: http://127.0.0.1:9090

Grafana: http://127.0.0.1:3000

(Por defecto) Usuario/Pass: admin / admin

Data Source: Prometheus → URL http://prometheus:9090 (si Grafana está en el mismo docker-compose).
Si usas Grafana fuera de Docker, usa http://127.0.0.1:9090

## Calidad
**Linter:**
`make lint`

**Formateo:**
`make fmt`

**Tests:**
`make test`

## Parada y limpieza
`make infra-down`


**Equipo UniGO - 2025**
