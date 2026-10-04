#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/.."
mkdir -p ios-qa
node scripts/e2e-server.mjs > ios-qa/backend.log 2>&1 &
backend_pid=$!
trap 'kill "$backend_pid" 2>/dev/null || true' EXIT
for i in $(seq 1 90); do
  if curl --silent --fail http://127.0.0.1:8788/health >/dev/null; then break; fi
  sleep 1
done
curl --silent --fail http://127.0.0.1:8788/health >/dev/null
device=$(xcrun simctl list devices available -j | python3 -c 'import json,sys; ds=[d for group in json.load(sys.stdin)["devices"].values() for d in group if d["name"].startswith("iPhone")]; print(next((d["udid"] for d in ds if "Pro" not in d["name"]),ds[0]["udid"]))')
xcrun simctl boot "$device"
xcrun simctl bootstatus "$device" -b
xcrun simctl status_bar "$device" override --time '09:41' --batteryState charged --batteryLevel 100
xcrun simctl install "$device" build-ios-ci/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch "$device" se.dinpuls.app --dinpuls-ci
node scripts/ios-e2e.mjs
xcrun simctl terminate "$device" se.dinpuls.app
xcrun simctl shutdown "$device"
