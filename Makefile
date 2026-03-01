.PHONY: up down build dev migrate seed deploy terraform-plan terraform-apply \
       logs clean docker-build docker-push terraform-init terraform-destroy \
       db-studio lint help

ENV ?= dev
REGION ?= us-central1
GCP_PROJECT_ID ?= your-gcp-project-id

# ── Local Development ───────────────────────────────────────────────────────

up: ## Start all services with docker-compose
	docker compose up -d --build

down: ## Stop all services
	docker compose down

dev: ## Start infra (Postgres, Redis) and run services locally via turbo
	docker compose up -d postgres redis
	pnpm dev

logs: ## Tail logs from all containers
	docker compose logs -f

clean: ## Remove containers, volumes, and built images
	docker compose down -v --rmi local

# ── Database ────────────────────────────────────────────────────────────────

migrate: ## Run database migrations
	pnpm --filter @sloppy/db db:migrate

seed: ## Seed the database
	pnpm --filter @sloppy/db db:seed

db-studio: ## Open Drizzle Studio
	pnpm --filter @sloppy/db db:studio

# ── Build ───────────────────────────────────────────────────────────────────

build: ## Build all packages and services
	pnpm build

lint: ## Run linting across the monorepo
	pnpm lint

# ── Docker ──────────────────────────────────────────────────────────────────

REGISTRY ?= $(REGION)-docker.pkg.dev/$(GCP_PROJECT_ID)/sloppy-$(ENV)
TAG ?= latest
SERVICES = api-gateway auth ai-orchestrator game-builder multiplayer web

docker-build: ## Build all Docker images
	@for svc in api-gateway auth ai-orchestrator game-builder multiplayer; do \
		echo "Building $$svc..."; \
		docker build -t $(REGISTRY)/$$svc:$(TAG) -f services/$$svc/Dockerfile . ; \
	done
	docker build -t $(REGISTRY)/web:$(TAG) -f apps/web/Dockerfile .

docker-push: ## Push all Docker images to Artifact Registry
	@for svc in $(SERVICES); do \
		docker push $(REGISTRY)/$$svc:$(TAG) ; \
	done

# ── Terraform ───────────────────────────────────────────────────────────────

TF_DIR = infra/terraform
TF_VARS ?= -var-file=terraform.tfvars

terraform-init: ## Initialize Terraform
	cd $(TF_DIR) && terraform init

terraform-plan: ## Preview infrastructure changes
	cd $(TF_DIR) && terraform plan $(TF_VARS)

terraform-apply: ## Apply infrastructure changes
	cd $(TF_DIR) && terraform apply $(TF_VARS)

terraform-destroy: ## Destroy infrastructure (use with caution)
	cd $(TF_DIR) && terraform destroy $(TF_VARS)

# ── Deployment ──────────────────────────────────────────────────────────────

deploy: ## Submit build to Cloud Build for deployment
	gcloud builds submit --config=cloudbuild.yaml \
		--substitutions=_ENVIRONMENT=$(ENV),_REGION=$(REGION)

# ── Help ────────────────────────────────────────────────────────────────────

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
