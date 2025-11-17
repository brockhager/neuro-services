## Contributing to Neuro-Services

Developer policy: use pnpm
This repository is part of the Neuro monorepo and uses pnpm workspaces. Please do not commit `package-lock.json` files. Use `pnpm install -w` at the repo root when working locally. If you accidentally generate a `package-lock.json`, please remove it and raise a PR linking to this CONTRIBUTING.md for review.

CI builds rely on pnpm to install consistent dependency versions across packages. The presence of a `package-lock.json` can result in inconsistent installs.

If you need help migrating a subproject to pnpm or removing `package-lock.json`, ask in Discord or open a ticket.

### PR flow
- Create a branch with a descriptive name
- Update code + docs and add unit/integration tests
- Run `pnpm install -w` then `pnpm -ws build && pnpm -ws test`
- Open a PR and add the CI checks required; include `docs-wiki-sync` if docs changed
- For release updates, use `scripts/publishUpdate.mjs` to prepare release notes and opens PR

---
