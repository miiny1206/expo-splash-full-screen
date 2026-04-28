# Maestro E2E flows

Flows verify the splash → app handoff and event API on a real simulator/emulator.

## Run locally

```bash
# Build + install the example on a running simulator/emulator first.
cd example && bun run ios   # or: bun run android

# Run all flows from repo root.
maestro test .maestro
```

## Flows

| File                    | Verifies                                                                 |
| ----------------------- | ------------------------------------------------------------------------ |
| `01-cold-start.yaml`    | Cold launch → splash → auto-hide → app visible + `didShow` + `didHide`.  |
| `02-process-death.yaml` | Force-stop + relaunch replays the splash (cold-start path re-runs).      |
| `03-buttons.yaml`       | Manual buttons (`hide`, `hide instant`, `full-screen`) do not crash app. |

## CI

`.github/workflows/ci.yml` runs these on `android-e2e` (API 35) and `ios-e2e` (latest sim).
