#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/../android"
mkdir -p app-screenshots
cleanup() {
  timeout 20 adb logcat -d > app-screenshots/device.log 2>&1 || true
  timeout 20 adb exec-out screencap -p > app-screenshots/current-screen.png || true
}
trap cleanup EXIT
timeout 360 ./gradlew :app:connectedDebugAndroidTest --no-daemon
