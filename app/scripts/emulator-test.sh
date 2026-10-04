#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/../android"
mkdir -p app-screenshots
node ../scripts/e2e-server.mjs > app-screenshots/isolated-backend.log 2>&1 &
backend_pid=$!
cleanup() {
  kill "$backend_pid" 2>/dev/null || true
  timeout 20 adb logcat -d > app-screenshots/device.log 2>&1 || true
  timeout 20 adb exec-out screencap -p > app-screenshots/current-screen.png || true
}
trap cleanup EXIT
timeout 20 adb reverse tcp:8788 tcp:8788
for i in $(seq 1 30); do
  if curl --silent --fail http://127.0.0.1:8788/health >/dev/null; then break; fi
  sleep 1
done
curl --silent --fail http://127.0.0.1:8788/health >/dev/null
timeout 20 adb shell settings put secure show_ime_with_hard_keyboard 1
timeout 600 ./gradlew :app:connectedDebugAndroidTest --no-daemon
timeout 20 adb pull /sdcard/Pictures/DinPulsCI/isolated-public-ad.png app-screenshots/isolated-public-ad.png
timeout 30 adb install -r app/build/outputs/apk/debug/app-debug.apk
for page in index.html lunch.html evenemang.html foreningsliv.html skola-familj.html praktiskt.html kris-beredskap.html foretag/start.html foreningskonto.html; do
  timeout 20 adb shell am start -a android.intent.action.VIEW -d "dinpuls://app/$page?kommun=%C3%85m%C3%A5l" se.dinpuls.app
  sleep 3
  name="${page//\//-}"
  timeout 20 adb exec-out screencap -p > "app-screenshots/$name.png"
done
