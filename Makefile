# News Intelligence Hub - common Docker workflows.
# `make help` lists targets. Dev uses docker-compose.yml + docker-compose.override.yml.

COMPOSE      := docker compose
COMPOSE_PROD := docker compose -f docker-compose.yml -f docker-compose.prod.yml

.DEFAULT_GOAL := help

.PHONY: help env up build down logs ps restart clean prod-up prod-down \
        fe-up fe-logs

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

env: ## Create .env from .env.example if missing
	@test -f .env || (cp .env.example .env && echo "Created .env - fill in the REQUIRED values")

up: env ## Build (if needed) and start the full dev stack
	$(COMPOSE) up --build

build: ## Build all images
	$(COMPOSE) build

down: ## Stop and remove containers
	$(COMPOSE) down

logs: ## Tail logs from all services
	$(COMPOSE) logs -f

ps: ## Show service status
	$(COMPOSE) ps

restart: ## Restart the stack
	$(COMPOSE) restart

clean: ## Stop and remove containers AND volumes (destroys DB/Redis data)
	$(COMPOSE) down -v

prod-up: ## Start the hardened production stack (detached)
	$(COMPOSE_PROD) up -d --build

prod-down: ## Stop the production stack
	$(COMPOSE_PROD) down

# ---- Frontend HMR --------------------------------------------------------- #

fe-up: ## Start only the frontend service with HMR in Docker (http://localhost:3000)
	$(COMPOSE) up frontend

fe-logs: ## Tail logs from the frontend container
	$(COMPOSE) logs -f frontend
