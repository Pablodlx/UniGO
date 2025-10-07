SHELL := /bin/bash

# -------- Paths --------
INFRA := infra
BACKEND := backend
FRONTEND := frontend

# -------- Helper --------
define ACTIVATE
source $(BACKEND)/.venv/bin/activate
endef

# -------- Infra --------
.PHONY: infra-up infra-down infra-logs
infra-up:
	docker compose -f $(INFRA)/docker-compose.yml up -d

infra-down:
	docker compose -f $(INFRA)/docker-compose.yml down -v

infra-logs:
	docker compose -f $(INFRA)/docker-compose.yml logs -f

# -------- Backend --------
.PHONY: backend-setup backend migrate revision lint fmt test
backend-setup:
	rm -rf backend/.venv
	cd $(BACKEND) && python3 -m venv .venv
	$(ACTIVATE) && pip install -U pip && pip install -r $(BACKEND)/requirements.txt || true

backend:
	$(ACTIVATE) && cd $(BACKEND) && uvicorn app.main:app --reload

migrate:
	$(ACTIVATE) && cd $(BACKEND) && alembic upgrade head

# Uso: make revision MSG="rf01: users + email_codes"
revision:
	@if [ -z "$$MSG" ]; then echo "Usage: make revision MSG=\"mensaje\""; exit 1; fi
	$(ACTIVATE) && cd $(BACKEND) && alembic revision --autogenerate -m "$$MSG"

lint:
	$(ACTIVATE) && cd $(BACKEND) && ruff check .
	$(ACTIVATE) && cd $(BACKEND) && black --check .

fmt:
	$(ACTIVATE) && cd $(BACKEND) && ruff check . --fix
	$(ACTIVATE) && cd $(BACKEND) && black .

test:
	$(ACTIVATE) && cd $(BACKEND) && pytest -q

# -------- Frontend --------
.PHONY: frontend-setup frontend
frontend-setup:
	cd $(FRONTEND) && npm install

frontend:
	cd $(FRONTEND) && npm run dev -- --port 5173

# -------- Convenience --------
.PHONY: urls
urls:
	@echo "Backend (Swagger):  http://127.0.0.1:8000/docs"
	@echo "Frontend (Vite):    http://127.0.0.1:3001"
	@echo "MailHog UI:         http://127.0.0.1:8025"
	@echo "Prometheus:         http://127.0.0.1:9090"
	@echo "Grafana:            http://127.0.0.1:3000"
