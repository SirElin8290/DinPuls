# Extern schemaläggare för väder och transport

Den separata Cloudflare Workern `dinpuls-github-scheduler` fungerar som en extern bevakare av de befintliga GitHub Actions-flödena. GitHubs egna `schedule`-triggers ligger kvar som fallback.

## Så fungerar den

- Väder kontrolleras 8, 18, 28, 38, 48 och 58 minuter över varje timme (UTC).
- Transport kontrolleras 10, 25, 40 och 55 minuter över varje timme (UTC).
- Workern läser de senaste körningarna via GitHub API.
- Om arbetsflödet redan är köat eller aktivt skickas ingen ny start.
- Om en lyckad körning startat nyligen (8 minuter för väder, 10 för transport) skickas ingen ny start. Detta hindrar Workern från att dubblera en fungerande GitHub-schemakörning.
- I övriga fall skickas `workflow_dispatch` för `main`.

Skyddet är avsiktligt utan egen databas: GitHubs körningslista är den gemensamma sanningskällan. GitHub-workflowernas befintliga `concurrency`-grupper är ett ytterligare skydd om två starter ändå skulle ske samtidigt.

## GitHub-token

Skapa en fine-grained personal access token med:

- Repository access: endast `SirElin8290/DinPuls`
- Repository permission: Actions – Read and write

Token ska aldrig läggas i GitHub, klientkod eller `wrangler.scheduler.jsonc`. Lägg in den interaktivt som Cloudflare-secret:

```powershell
npx wrangler secret put GITHUB_TOKEN --config wrangler.scheduler.jsonc
```

Övriga värden är icke-hemliga och finns i `wrangler.scheduler.jsonc`:

- `GITHUB_OWNER=SirElin8290`
- `GITHUB_REPO=DinPuls`
- `GITHUB_REF=main`

## Test och deploy

Kör det permanenta enhetstestet:

```powershell
node scripts/test_github_scheduler_worker.mjs
```

Validera konfiguration och bygg lokalt utan publicering:

```powershell
npx wrangler deploy --dry-run --config wrangler.scheduler.jsonc
```

Publicera först efter att `GITHUB_TOKEN` lagts in:

```powershell
npx wrangler deploy --config wrangler.scheduler.jsonc
```

Cron-konfigurationen följer med deployen från `wrangler.scheduler.jsonc`. Cloudflare kör cron i UTC och ändringar kan ta upp till 15 minuter att slå igenom.
