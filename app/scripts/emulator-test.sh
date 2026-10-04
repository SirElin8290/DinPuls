#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/../android"
mkdir -p app-screenshots
cleanup() {
  timeout 20 adb logcat -d > app-screenshots/device.log 2>&1 || true
  timeout 20 adb exec-out screencap -p > app-screenshots/current-screen.png || true
}
trap cleanup EXIT
timeout 20 adb shell settings put secure show_ime_with_hard_keyboard 1
timeout 360 ./gradlew :app:connectedDebugAndroidTest --no-daemon
for page in index.html lunch.html evenemang.html foreningsliv.html skola-familj.html praktiskt.html kris-beredskap.html foretag/start.html foreningskonto.html; do
  timeout 20 adb shell am start -a android.intent.action.VIEW -d "dinpuls://app/$page?kommun=%C3%85m%C3%A5l" se.dinpuls.app
  sleep 3
  name="${page//\//-}"
  timeout 20 adb exec-out screencap -p > "app-screenshots/$name.png"
done
