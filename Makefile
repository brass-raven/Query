.PHONY: help docker-up docker-down docker-restart docker-reset docker-logs docker-logs-dev docker-logs-prod docker-status docker-diff docker-psql-dev docker-psql-prod docker-clean

# Default target - show help
help:
	@echo "Query - Docker Database Management"
	@echo ""
	@echo "Available commands:"
	@echo "  make docker-up          - Start PostgreSQL databases (dev + prod)"
	@echo "  make docker-down        - Stop PostgreSQL databases"
	@echo "  make docker-restart     - Restart PostgreSQL databases"
	@echo "  make docker-reset       - Reset databases (remove all data and start fresh)"
	@echo "  make docker-logs        - Show logs from both databases (follow mode)"
	@echo "  make docker-logs-dev    - Show development database logs only"
	@echo "  make docker-logs-prod   - Show production database logs only"
	@echo "  make docker-status      - Show container status and health checks"
	@echo "  make docker-diff        - Compare table row counts between dev and prod"
	@echo "  make docker-psql-dev    - Connect to development database with psql"
	@echo "  make docker-psql-prod   - Connect to production database with psql"
	@echo "  make docker-clean       - Stop containers and remove volumes"
	@echo ""
	@echo "Database credentials:"
	@echo "  Dev:  postgresql://queryuser:querypass@localhost:5432/querydb_dev"
	@echo "  Prod: postgresql://queryuser:querypass@localhost:5433/querydb_prod"

# Start databases
docker-up:
	@echo "Starting PostgreSQL databases (dev + prod)..."
	@docker-compose up -d
	@echo ""
	@echo "Waiting for databases to be ready..."
	@sleep 3
	@echo ""
	@echo "Checking development database..."
	@docker-compose exec -T postgres-dev pg_isready -U queryuser -d querydb_dev || true
	@echo ""
	@echo "Checking production database..."
	@docker-compose exec -T postgres-prod pg_isready -U queryuser -d querydb_prod || true
	@echo ""
	@echo "✓ Databases are starting up!"
	@echo ""
	@echo "=== DEVELOPMENT DATABASE ==="
	@echo "  Host: localhost"
	@echo "  Port: 5432"
	@echo "  Database: querydb_dev"
	@echo "  Username: queryuser"
	@echo "  Password: querypass"
	@echo "  Connection: postgresql://queryuser:querypass@localhost:5432/querydb_dev"
	@echo ""
	@echo "=== PRODUCTION DATABASE ==="
	@echo "  Host: localhost"
	@echo "  Port: 5433"
	@echo "  Database: querydb_prod"
	@echo "  Username: queryuser"
	@echo "  Password: querypass"
	@echo "  Connection: postgresql://queryuser:querypass@localhost:5433/querydb_prod"
	@echo ""
	@echo "Note: Initialization may take 1-2 minutes"
	@echo "Monitor progress: make docker-logs"

# Stop databases
docker-down:
	@echo "Stopping PostgreSQL databases..."
	@docker-compose down
	@echo "✓ Databases stopped."

# Restart databases
docker-restart:
	@echo "Restarting PostgreSQL databases..."
	@docker-compose restart
	@echo "✓ Databases restarted."

# Reset databases (remove volumes)
docker-reset:
	@echo "⚠️  This will delete ALL database data!"
	@echo "Resetting databases (removing all data)..."
	@docker-compose down -v
	@echo "Starting fresh databases..."
	@docker-compose up -d
	@echo "✓ Databases reset complete. Initialization in progress..."

# Show logs from both databases
docker-logs:
	@docker-compose logs -f

# Show development database logs
docker-logs-dev:
	@docker-compose logs -f postgres-dev

# Show production database logs
docker-logs-prod:
	@docker-compose logs -f postgres-prod

# Show container status and health
docker-status:
	@docker-compose ps
	@echo ""
	@echo "Health checks:"
	@docker-compose exec -T postgres-dev pg_isready -U queryuser -d querydb_dev && echo "✓ Development database is ready" || echo "✗ Development database not ready"
	@docker-compose exec -T postgres-prod pg_isready -U queryuser -d querydb_prod && echo "✓ Production database is ready" || echo "✗ Production database not ready"

# Compare table counts between dev and prod
docker-diff:
	@echo "Comparing table counts between dev and prod..."
	@echo ""
	@echo "=== DEVELOPMENT ==="
	@docker-compose exec -T postgres-dev psql -U queryuser -d querydb_dev -c "\
		SELECT \
			schemaname || '.' || tablename as table_name, \
			n_live_tup as row_count \
		FROM pg_stat_user_tables \
		ORDER BY tablename;"
	@echo ""
	@echo "=== PRODUCTION ==="
	@docker-compose exec -T postgres-prod psql -U queryuser -d querydb_prod -c "\
		SELECT \
			schemaname || '.' || tablename as table_name, \
			n_live_tup as row_count \
		FROM pg_stat_user_tables \
		ORDER BY tablename;"

# Connect to development database
docker-psql-dev:
	@docker-compose exec postgres-dev psql -U queryuser -d querydb_dev

# Connect to production database
docker-psql-prod:
	@docker-compose exec postgres-prod psql -U queryuser -d querydb_prod

# Clean up (stop and remove volumes)
docker-clean:
	@echo "Stopping containers and removing volumes..."
	@docker-compose down -v
	@echo "✓ Cleanup complete."
