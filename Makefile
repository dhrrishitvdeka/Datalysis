.PHONY: help dev build test lint clean docker-build docker-up

help:
	@echo "Available targets:"
	@echo "  make dev          - Run backend with reload and frontend dev server"
	@echo "  make build        - Build frontend production distribution"
	@echo "  make test         - Run full pytest test suite"
	@echo "  make lint         - Run ruff linter on Python code"
	@echo "  make clean        - Remove Python cache files and build artifacts"
	@echo "  make docker-build - Build production Docker image"
	@echo "  make docker-up    - Start Docker container stack"

dev:
	python -m backend.app.cli launch --host 127.0.0.1 --port 8000 --reload

build:
	cd frontend && npm install && npm run build

test:
	pytest -v

lint:
	python -m ruff check backend tests

clean:
	rm -rf build dist *.egg-info .pytest_cache .coverage
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

docker-build:
	docker build -t datalysis:latest .

docker-up:
	docker compose up -d
