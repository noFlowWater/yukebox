#!/usr/bin/env bash
set -euo pipefail

echo "=== YukeBox Cleanup ==="
echo ""

ALL=false
if [[ "${1:-}" == "--all" ]]; then
  ALL=true
fi

# 1. Stop containers + remove network (always)
echo "[1/4] Stopping containers and removing network..."
if docker compose ps --quiet 2>/dev/null | grep -q .; then
  docker compose down
  echo "      Containers and network removed."
else
  docker compose down 2>/dev/null || true
  echo "      No running containers found. Skipped."
fi

# 2. Remove Docker images
remove_images() {
  local images
  images=$(docker images --filter "reference=yukebox-backend" --filter "reference=yukebox-frontend" -q 2>/dev/null || true)
  if [ -z "$images" ]; then
    echo "      No YukeBox images found. Skipped."
    return
  fi
  docker rmi yukebox-backend yukebox-frontend 2>/dev/null || true
  echo "      Images removed."
}

echo ""
echo "[2/4] Docker images (yukebox-backend, yukebox-frontend)"
if $ALL; then
  remove_images
else
  read -rp "      Remove Docker images? [y/N] " yn
  if [[ "$yn" =~ ^[Yy] ]]; then
    remove_images
  else
    echo "      Kept."
  fi
fi

# 3. Remove Docker volume (DB data)
remove_volume() {
  # docker compose uses project name from directory: yukebox
  local vol
  vol=$(docker volume ls --filter "name=yukebox_backend-data" -q 2>/dev/null || true)
  if [ -z "$vol" ]; then
    echo "      No YukeBox volume found. Skipped."
    return
  fi
  docker volume rm "$vol"
  echo "      Volume removed."
}

echo ""
echo "[3/4] Docker volume (SQLite DB and user data)"
if $ALL; then
  remove_volume
else
  echo "      WARNING: This deletes your database, queue history, and all user data."
  read -rp "      Remove Docker volume? [y/N] " yn
  if [[ "$yn" =~ ^[Yy] ]]; then
    remove_volume
  else
    echo "      Kept."
  fi
fi

# 4. Remove .env file
remove_env() {
  if [ ! -f .env ]; then
    echo "      No .env file found. Skipped."
    return
  fi
  rm .env
  echo "      .env removed."
}

echo ""
echo "[4/4] .env file"
if $ALL; then
  remove_env
else
  read -rp "      Remove .env file? [y/N] " yn
  if [[ "$yn" =~ ^[Yy] ]]; then
    remove_env
  else
    echo "      Kept."
  fi
fi

echo ""
echo "Cleanup complete."
