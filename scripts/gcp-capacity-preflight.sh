#!/usr/bin/env bash
set -euo pipefail
# Cloud Build worker only; all Docker artifacts/volumes disappear with the worker.
socket=/cloudsql/cynk-staging:asia-south2:cynk-staging-db
cleanup() { docker rm -f capacity-app capacity-db >/dev/null 2>&1 || true; docker volume rm capacity-sockets >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker build --target tooling -t cynk-capacity-tooling -f deployment/gcp/Dockerfile \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID=cynk-staging-e9c53 \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=synthetic-capacity-public-key \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID=synthetic-capacity-app \
  --build-arg NEXT_PUBLIC_APP_URL=https://cynk-staging-backend-1002434130638.asia-south2.run.app .
docker build --target capacity -t cynk-capacity-app -f deployment/gcp/Dockerfile \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID=cynk-staging-e9c53 \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=synthetic-capacity-public-key \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID=synthetic-capacity-app \
  --build-arg NEXT_PUBLIC_APP_URL=https://cynk-staging-backend-1002434130638.asia-south2.run.app .
docker volume create capacity-sockets >/dev/null
docker run -d --name capacity-db --memory=768m --cpus=1 \
  --mount type=volume,source=capacity-sockets,target=/cloudsql \
  -e POSTGRES_USER=cynk_migrator -e POSTGRES_PASSWORD=synthetic-fixture-only -e POSTGRES_DB=cynk_staging \
  --entrypoint bash postgres:16-bookworm -c \
  "mkdir -p '$socket'; chown postgres:postgres '$socket'; exec docker-entrypoint.sh postgres -c unix_socket_directories='/var/run/postgresql,$socket'" >/dev/null
db_ready=false
for i in $(seq 1 60); do
  if docker exec capacity-db pg_isready -U cynk_migrator -d cynk_staging >/dev/null 2>&1; then db_ready=true; break; fi
  test "$(docker inspect --format '{{.State.Running}}' capacity-db)" = true || break
  sleep 1
done
if ! $db_ready; then docker logs --tail 25 capacity-db; exit 1; fi
docker exec capacity-db psql -U cynk_migrator -d cynk_staging -v ON_ERROR_STOP=1 -c \
  "CREATE ROLE cloudsqlsuperuser; CREATE ROLE cynk_runtime LOGIN PASSWORD 'synthetic-fixture-only';" >/dev/null
cat > /tmp/capacity.env <<EOF
CAPACITY_FIXTURE=true
DEPLOYMENT_TARGET=cloud-run
GCP_PROJECT_ID=cynk-staging
FIREBASE_AUTH_PROJECT_ID=cynk-staging-e9c53
APP_ENV=staging
CLOUD_SQL_CONNECTION_NAME=cynk-staging:asia-south2:cynk-staging-db
AUTH_PROVIDER=identity-platform
NEXT_PUBLIC_AUTH_PROVIDER=identity-platform
NEXT_PUBLIC_FIREBASE_PROJECT_ID=cynk-staging-e9c53
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=cynk-staging-e9c53.firebaseapp.com
NEXT_PUBLIC_FIREBASE_API_KEY=synthetic-capacity-public-key
NEXT_PUBLIC_FIREBASE_APP_ID=synthetic-capacity-app
APP_URL=https://cynk-staging-backend-1002434130638.asia-south2.run.app
NEXT_PUBLIC_APP_URL=https://cynk-staging-backend-1002434130638.asia-south2.run.app
FILE_STORAGE_MODE=gcs
LOCAL_DEMO=false
RECOMMENDATION_WORKER_ENABLED=false
MIGRATION_MAINTENANCE=false
DATABASE_URL=postgresql://cynk_runtime:synthetic-fixture-only@localhost/cynk_staging?host=$socket&connection_limit=2&pool_timeout=10
DIRECT_URL=postgresql://cynk_migrator:synthetic-fixture-only@localhost/cynk_staging?host=$socket
EOF
docker run --rm --mount type=volume,source=capacity-sockets,target=/cloudsql --env-file /tmp/capacity.env cynk-capacity-tooling
docker exec -i capacity-db psql -U cynk_migrator -d cynk_staging -v ON_ERROR_STOP=1 < deployment/gcp/database-access.sql >/dev/null
docker run --rm --mount type=volume,source=capacity-sockets,target=/cloudsql --env-file /tmp/capacity.env \
  --entrypoint node cynk-capacity-tooling scripts/gcp-capacity-workload.cjs seed
for memory in 512 1024 2048; do
  echo "CAPACITY_LIMIT_MIB=$memory"
  docker run -d --name capacity-app --cpus=1 --memory="${memory}m" --memory-swap="${memory}m" --pids-limit=256 \
    --mount type=volume,source=capacity-sockets,target=/cloudsql --env-file /tmp/capacity.env -e CAPACITY_MEMORY_MIB="$memory" cynk-capacity-app >/dev/null
  begin=$(date +%s); ready=false
  for i in $(seq 1 60); do
    if docker exec capacity-app node -e "fetch('http://127.0.0.1:8080/api/health').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then ready=true; break; fi
    test "$(docker inspect --format '{{.State.Running}}' capacity-app)" = true || break
    sleep 1
  done
  echo "CAPACITY_STARTUP_SECONDS=$(($(date +%s)-begin))"
  docker inspect --format 'CAPACITY_DOCKER_LIMITS memory={{.HostConfig.Memory}} swap={{.HostConfig.MemorySwap}} nanoCpus={{.HostConfig.NanoCpus}}' capacity-app
  result=1
  if $ready; then
    set +e
    docker exec capacity-app node .next/standalone/capacity-workload.cjs
    result=$?
    set -e
  fi
  docker exec capacity-app sh -c 'for f in /sys/fs/cgroup/memory.peak /sys/fs/cgroup/memory.events /sys/fs/cgroup/memory/memory.max_usage_in_bytes; do if test -r "$f"; then echo "CAPACITY_CGROUP_FILE=$f"; cat "$f"; fi; done' || true
  docker inspect --format 'CAPACITY_STATE running={{.State.Running}} oomKilled={{.State.OOMKilled}} exitCode={{.State.ExitCode}}' capacity-app
  docker logs --tail 12 capacity-app
  docker rm -f capacity-app >/dev/null
  if test "$result" = 0; then echo "CAPACITY_SMALLEST_TESTED_STABLE_MIB=$memory"; exit 0; fi
done
echo CAPACITY_NO_STABLE_CONFIGURATION
exit 1
