# wiki (argus-context package)

Native fork of [langchain-ai/openwiki](https://github.com/langchain-ai/openwiki), now living as `packages/wiki` inside [`argus-context`](../../README.md) rather than its own repo. Previously `deanjstone/argus-wiki`; merged in via `git subtree` with full commit history preserved (`git log packages/wiki` from the repo root).

## Fork status

This package carries no `upstream` remote in argus-context — it is a **hard fork with no live upstream tracking wired up here**. The hard-fork decision (never routinely merge from `langchain-ai/openwiki`, no obligation to track releases, no upstream contributions) was locked in while this was still the standalone `argus-wiki` repo; full rationale is preserved at [deanjstone/argus-wiki#15](https://github.com/deanjstone/argus-wiki/issues/15) (archived repo, history read-only). Any future upstream diff would be checked manually on GitHub and cherry-picked by hand — there is no `git subtree pull` path configured.

MIT-licensed upstream code: see [`LICENSE`](LICENSE) and the attribution in [`README.md`](README.md).

## Local divergence from upstream

- `src/constants.ts` / `src/arguswiki-home.ts` — `OPEN_WIKI_DIR` and `argusWikiHomeDir` are env-overridable (`ARGUSWIKI_OUTPUT_DIR`, `ARGUSWIKI_HOME`), defaulting to upstream's original paths when unset.
- `src/constants.ts` — `ArgusWikiProvider` is narrowed to `"claude-cli"` only. This fork only ever runs headless via `ARGUSWIKI_PROVIDER=claude-cli`; all other agent backends, the LangChain/LangGraph execution core, and PostHog telemetry were removed ([deanjstone/argus-wiki#35](https://github.com/deanjstone/argus-wiki/issues/35)). The provider abstraction itself (`ArgusWikiProvider` union, `PROVIDER_CONFIGS` keyed lookup) remains pluggable, just narrowed to one member.

## Not yet done

Wiring this package to actually generate/maintain `~/CONTEXT` vault content end-to-end is tracked separately as [deanjstone/context#3](https://github.com/deanjstone/context/issues/3) — moving this code into argus-context does not by itself complete that feature.

---

## ArgusWiki (upstream, self-generated)

This package has documentation located in the `openwiki/` directory (i.e. `packages/wiki/openwiki/` from the repo root).

Start here:

- [ArgusWiki quickstart](openwiki/quickstart.md)

ArgusWiki includes repository overview, architecture notes, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

When working in this package, read the ArgusWiki quickstart first, then follow its links to the relevant architecture, workflow, domain, operation, and testing notes.

<!-- ARGUSWIKI:START -->

## ArgusWiki

This repository uses ArgusWiki for recurring code documentation. Start with `openwiki/quickstart.md`, then follow its links to architecture, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

The scheduled ArgusWiki GitHub Actions workflow refreshes the repository wiki. Do not hand-edit generated ArgusWiki pages unless explicitly asked; prefer updating source code/docs and letting ArgusWiki regenerate.

<!-- ARGUSWIKI:END -->
