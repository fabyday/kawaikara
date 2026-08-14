# Packaging

This directory contains packaging hooks and metadata, not compiled app code.

- Runtime JavaScript bundles are written to `dist/`.
- Packaged applications and updater metadata are written to `builds/`.
- Static application assets remain in `resources/`.
- `after-pack.cjs` applies and verifies the Castlabs EVS VMP signature before
  Electron Builder performs operating-system code signing.

Castlabs account credentials are never stored in this directory or committed
to the repository. Use `pnpm widevine:auth` to cache local EVS authorization.

For unattended local development, copy `.env.example` to `.env.local` and set:

```dotenv
KAWAIKARA_EVS_ACCOUNT=your-castlabs-account
KAWAIKARA_EVS_PASSWORD="your-castlabs-password"
```

`package:dev`, `widevine:*`, and local update packaging automatically load
`.env.local`. Shell and CI environment variables take precedence. The file is
Git-ignored, but it contains a plaintext password, so interactive
`pnpm widevine:auth` is safer on a shared computer.

## Output layout

```text
dist/                              Webpack runtime bundles
builds/dev/mac/arm64/              Local Apple Silicon package
builds/dev/mac/x64/                Local Intel macOS package
builds/dev/win/x64/                Local Windows package
builds/stable/mac/                 Stable macOS artifacts and update metadata
builds/staging/mac/                Staging macOS artifacts and update metadata
builds/nightly/mac/                Nightly macOS artifacts and update metadata
```

Release macOS architectures share their channel/platform directory because
Electron Builder must merge both architectures into one updater metadata file.
Its unpacked application folders still distinguish `mac/` (x64) and
`mac-arm64/` (Apple Silicon).

## Commands

```sh
pnpm widevine:auth
pnpm package:dev
pnpm widevine:verify

pnpm update:build:stable
pnpm update:build:staging
pnpm update:build:nightly

pnpm update:publish:stable
pnpm update:publish:staging
pnpm update:publish:nightly
```

The `update:build:*` commands generate installers and updater metadata without
publishing. The `update:publish:*` commands upload them to the configured
GitHub release channel and therefore require release credentials.
