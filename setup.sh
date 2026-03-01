#!/usr/bin/env bash
set -euo pipefail

echo "=== YukeBox Setup ==="
echo ""

# 1. OS check
if [[ "$(uname)" != "Linux" ]]; then
  echo "Error: YukeBox requires Linux (PulseAudio + Bluetooth)"
  exit 1
fi

# 2. Docker check
if ! command -v docker &>/dev/null; then
  echo "Error: Docker not found. Install: https://docs.docker.com/engine/install/"
  exit 1
fi
if ! docker compose version &>/dev/null && ! command -v docker-compose &>/dev/null; then
  echo "Error: docker compose not found."
  exit 1
fi
echo "[OK] Docker found"

# 3. PulseAudio/PipeWire check
PULSE_SOCKET="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/pulse/native"
if [ -S "$PULSE_SOCKET" ]; then
  echo "[OK] PulseAudio socket: $PULSE_SOCKET"
else
  echo "[!!] PulseAudio socket not found at $PULSE_SOCKET"
  echo "     Make sure PulseAudio or PipeWire (with pipewire-pulse) is running."
  read -rp "     Continue anyway? [y/N] " yn
  [[ "$yn" =~ ^[Yy] ]] || exit 1
fi

# 4. Bluetooth device check + interactive connect
if command -v bluetoothctl &>/dev/null; then
  DEVICES=$(bluetoothctl devices Connected 2>/dev/null || true)
  if [ -n "$DEVICES" ]; then
    echo "[OK] Connected Bluetooth devices:"
    echo "$DEVICES" | sed 's/^/     /'
  else
    echo "[!!] No Bluetooth devices connected."

    # Collect paired devices into arrays
    BT_MACS=()
    BT_NAMES=()
    while read -r _ mac name; do
      [ -z "$mac" ] && continue
      BT_MACS+=("$mac")
      BT_NAMES+=("$name")
    done <<< "$(bluetoothctl devices Paired 2>/dev/null || true)"

    if [ ${#BT_MACS[@]} -gt 0 ]; then
      echo ""
      echo "     Paired devices:"
      for i in "${!BT_MACS[@]}"; do
        echo "       $((i+1))) ${BT_NAMES[$i]} (${BT_MACS[$i]})"
      done
      echo "       0) Skip"
      echo ""
      read -rp "     Select device to connect [0]: " choice
      choice="${choice:-0}"

      if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le ${#BT_MACS[@]} ]; then
        selected_mac="${BT_MACS[$((choice-1))]}"
        selected_name="${BT_NAMES[$((choice-1))]}"
        echo "     Connecting to ${selected_name}..."
        if bluetoothctl connect "$selected_mac" 2>/dev/null | grep -q "successful"; then
          echo "[OK] Connected to ${selected_name}"
        else
          echo "[!!] Failed to connect to ${selected_name}"
          read -rp "     Continue anyway? [y/N] " yn
          [[ "$yn" =~ ^[Yy] ]] || exit 1
        fi
      else
        echo "     Skipped Bluetooth connection."
      fi
    else
      echo ""
      echo "     No paired devices found. Scanning for nearby devices..."
      # Start scan, collect for 8 seconds, then stop
      bluetoothctl power on &>/dev/null || true
      bluetoothctl scan on &>/dev/null &
      SCAN_PID=$!
      echo "     Scanning for 8 seconds..."
      sleep 8
      kill "$SCAN_PID" 2>/dev/null || true
      bluetoothctl scan off &>/dev/null || true

      # Collect discovered devices
      DISC_MACS=()
      DISC_NAMES=()
      while read -r _ mac name; do
        [ -z "$mac" ] && continue
        DISC_MACS+=("$mac")
        DISC_NAMES+=("$name")
      done <<< "$(bluetoothctl devices 2>/dev/null || true)"

      if [ ${#DISC_MACS[@]} -gt 0 ]; then
        echo ""
        echo "     Found devices:"
        for i in "${!DISC_MACS[@]}"; do
          echo "       $((i+1))) ${DISC_NAMES[$i]} (${DISC_MACS[$i]})"
        done
        echo "       0) Skip"
        echo ""
        read -rp "     Select device to pair & connect [0]: " choice
        choice="${choice:-0}"

        if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le ${#DISC_MACS[@]} ]; then
          selected_mac="${DISC_MACS[$((choice-1))]}"
          selected_name="${DISC_NAMES[$((choice-1))]}"
          echo "     Pairing with ${selected_name}..."
          bluetoothctl pair "$selected_mac" 2>/dev/null || true
          bluetoothctl trust "$selected_mac" 2>/dev/null || true
          echo "     Connecting to ${selected_name}..."
          if bluetoothctl connect "$selected_mac" 2>/dev/null | grep -q "successful"; then
            echo "[OK] Connected to ${selected_name}"
          else
            echo "[!!] Failed to connect to ${selected_name}"
            read -rp "     Continue anyway? [y/N] " yn
            [[ "$yn" =~ ^[Yy] ]] || exit 1
          fi
        else
          echo "     Skipped Bluetooth setup."
        fi
      else
        echo "     No devices found nearby."
        read -rp "     Continue without Bluetooth? [y/N] " yn
        [[ "$yn" =~ ^[Yy] ]] || exit 1
      fi
    fi
  fi
fi

# 5. Generate .env
echo ""
if [ -f .env ]; then
  echo ".env already exists. Skipping generation."
else
  JWT_SECRET=$(openssl rand -base64 32)
  # Detect PulseAudio cookie
  PULSE_COOKIE=""
  if [ -f "${HOME}/.config/pulse/cookie" ]; then
    PULSE_COOKIE="${HOME}/.config/pulse/cookie"
  elif [ -f "${HOME}/.pulse-cookie" ]; then
    PULSE_COOKIE="${HOME}/.pulse-cookie"
  fi

  cat > .env <<EOF
PORT=3000
NODE_ENV=production
PULSE_SOCKET=$PULSE_SOCKET
PULSE_COOKIE=$PULSE_COOKIE
JWT_SECRET=$JWT_SECRET
EOF
  echo "Created .env with auto-detected settings."
fi

# 6. Pull & run
echo ""
read -rp "Pull images and start YukeBox? [Y/n] " yn
if [[ ! "$yn" =~ ^[Nn] ]]; then
  docker compose pull && docker compose up -d
  echo ""
  echo "YukeBox is running at http://localhost:${PORT:-3000}"
  echo "Open in your browser to get started."
fi
