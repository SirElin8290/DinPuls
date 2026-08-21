from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
index = (ROOT / "index.html").read_text(encoding="utf-8")
client = (ROOT / "push-notifications.js").read_text(encoding="utf-8")
worker = (ROOT / "push-service-worker.js").read_text(encoding="utf-8")
config = json.loads((ROOT / "data/push-config.json").read_text(encoding="utf-8"))

for category in ("extreme-weather", "missing-people", "important"):
    assert f'"{category}"' in client, f"Obligatorisk kategori saknas: {category}"

assert "Notification.requestPermission()" in client
assert 'addEventListener("click", enablePush)' in client
assert client.index('addEventListener("click", enablePush)') < client.index("document.readyState")
assert "Missing People kan även omfatta angränsande kommuner" in index
assert 'data-push-category="traffic"' in index
assert 'data-push-category="sport"' in index
assert 'self.addEventListener("push"' in worker
assert 'self.addEventListener("notificationclick"' in worker
assert config.get("enabled") is True
assert config.get("apiBase") == "https://dinpuls-push.soren-johansson-7.workers.dev"
assert isinstance(config.get("publicKey"), str) and len(config["publicKey"]) >= 80

print("✓ Pushgrunden kräver aktivt val, har rätt kommunomfång och en komplett serverkonfiguration")
