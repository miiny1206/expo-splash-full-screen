# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.0.x   | ✅        |
| < 1.0   | ❌        |

## Reporting a Vulnerability

Report vulnerabilities privately via GitHub Security Advisories:

https://github.com/miiny1206/expo-splash-full-screen/security/advisories/new

Do not file public issues for security reports. Initial response within 7 days. Fix and disclosure coordinated with the reporter.

## Scope

In scope:

- Code execution via plugin (prebuild) — e.g. crafted `app.json` props that escape `platformProjectRoot`.
- Resource injection via the config plugin (Info.plist, AndroidManifest, drawables, imagesets).
- Native overlay code (Swift / Kotlin) — denial of service, crash on launch.

Out of scope:

- Vulnerabilities in upstream dependencies (`@expo/config-plugins`, `expo-modules-core`). Report to those projects directly.
- Issues caused by user-supplied images (corrupt PNG, oversized assets).
- Issues only reproducible with `--dangerouslyDisableSandbox` or modified plugin source.
