#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/.."
mkdir -p ios-qa
node scripts/e2e-server.mjs > ios-qa/backend.log 2>&1 &
backend_pid=$!
cleanup(){
 kill "$backend_pid" 2>/dev/null || true
 if [ -d ios-qa-large ]; then mkdir -p ios-qa; mv ios-qa-large ios-qa/large; fi
}
trap cleanup EXIT
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
mv ios-qa ios-qa-large
runtime=$(xcrun simctl list runtimes available -j | python3 -c 'import json,sys; print(next(r["identifier"] for r in json.load(sys.stdin)["runtimes"] if r["name"].startswith("iOS")))')
small=$(xcrun simctl create DinPuls-small com.apple.CoreSimulator.SimDeviceType.iPhone-SE-3rd-generation "$runtime")
xcrun simctl boot "$small"
xcrun simctl bootstatus "$small" -b
xcrun simctl status_bar "$small" override --time '09:41' --batteryState charged --batteryLevel 100
xcrun simctl install "$small" build-ios-ci/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch "$small" se.dinpuls.app --dinpuls-ci
IOS_LAYOUT_ONLY=1 node scripts/ios-e2e.mjs
xcrun simctl shutdown "$small"
mv ios-qa ios-qa-small
mkdir ios-qa
mv ios-qa-large ios-qa/large
mv ios-qa-small ios-qa/small
