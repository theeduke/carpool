#!/bin/bash
# Wait for the PostgreSQL database to be ready
until psql "$DATABASE_URL" -c '\l' > /dev/null 2>&1; do
  echo "Waiting for database to be ready..."
  sleep 2
done
echo "Database is ready!"

# Execute the command passed to the container (e.g., daphne, celery)
exec "$@"