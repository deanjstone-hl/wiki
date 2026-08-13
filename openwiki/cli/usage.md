---
type: CLI reference
title: ArgusWiki CLI usage
description: Reference for ArgusWiki command-line usage, including interactive and non-interactive runs, initialization and update modes, connector operations, and authentication setup. Covers provider configuration, model selection, validation, and the source files to update when changing CLI behavior.
tags: [arguswiki, cli, commands, configuration, authentication]
---

# CLI usage

ArgusWiki ships as a single `openwiki` binary (the command name itself was not part of the OpenWiki→ArgusWiki rebrand) and is intended to work both as an interactive terminal app and as a one-shot documentation runner.

## Commands and modes

From `src/commands.ts` and `README.md`, the supported entry patterns are:

- `openwiki` — open the interactive chat UI.
- `openwiki "message"` — send a chat message immediately, then stay open.
- `openwiki personal --init [message]` — generate initial local personal brain wiki documentation. **Currently errors under this fork** — see the caveat below.
- `openwiki code --init [message]` — generate initial repository documentation.
- `openwiki --update [message]` — refresh existing ArgusWiki documentation.
- `openwiki -p, --print` — run once and print the final assistant output (non-interactive).
- `openwiki --modelId <id>` / `--model-id <id>` — choose a model ID for the run.
- `openwiki --help` / `-h` — print usage, options, and examples.
- `openwiki --dry-run` — development-only option that avoids invoking the agent.

### Connector and operational subcommands

- `openwiki auth <provider>` — run OAuth login for a connector provider (gmail, notion, slack, x).
- `openwiki auth configure <provider> [--force]` — create local connector config that references saved auth env vars.
- `openwiki auth tools <provider>` — list available MCP tools for a connector (e.g. notion).
- `openwiki auth` (no provider) — list supported auth providers and their status.
- `openwiki ngrok start [url] [--port <port>]` — start an ngrok HTTPS tunnel for Slack OAuth callback.
- `openwiki cron list` — show saved connector schedules, launchd state, and the Mac wake window.
- `openwiki cron pause <source|all>` — unload launchd job(s), keep cron metadata, reconcile `pmset` wake window.
- `openwiki cron resume <source|all>` — reinstall paused launchd job(s) and reconcile `pmset` wake window.
- `openwiki cron delete <source|all>` — unload and remove schedule metadata (does not remove auth, config, raw data, or wiki content).
- `openwiki ingest [target]` — run source-specific ingestion for configured connectors.

The parser rejects incompatible combinations such as `--init` and `--update` together, and it requires a message or command when `--print` is used.

**`personal` mode currently errors.** The agent runtime's only backend (`runClaudeCliAgent()`, see [Agent workflow: Claude Code CLI provider](../agent/workflow.md#claude-code-cli-provider)) unconditionally rejects `local-wiki` output mode, which is what `personal` mode and the wiki-synthesis step of `openwiki ingest` both request. `openwiki personal --init/--update` and `openwiki ingest <target>` will fail with "The claude-cli provider only supports repository output mode." Deterministic connector ingestion (raw data fetch/write) is unaffected; only the agent synthesis step that follows it fails. Treat this as a known gap, not documentation error, until source changes.

### Auto-exit for init/update

When explicit init (`openwiki personal --init` or `openwiki code --init`) or `--update` is run in a TTY (without `--print`), the CLI starts the run, streams agent output, and **exits automatically on success** (`shouldAutoExitStartupRun` in `src/cli.tsx`). Chat runs and `--print` runs are not affected — chat stays open for follow-ups, and `--print` writes to stdout and exits.

### Non-interactive mode

If stdin is not a TTY (e.g. CI), or `--print` is used, the CLI still runs `needsCredentialSetup()`'s checks non-interactively instead of prompting. In practice the sole provider (`claude-cli`) is keyless and has no required env key, so this mostly matters for an explicitly invalid `ARGUSWIKI_PROVIDER` value or a missing model ID override — the run errors with a clear message rather than hanging on a prompt. The `claude` CLI itself must still be installed and authenticated in the run environment; ArgusWiki does not verify that up front.

## Interactive behavior

`src/cli.tsx` is the Ink-based app shell. It handles:

- chat submission and follow-up messages,
- `init` / `update` command launches (including from `/init` and `/update` slash commands),
- provider and model selection during the session (`/provider`, `/model`),
- interactive credential setup when required (including for init/update, not just chat),
- streaming agent text and tool events,
- completed-run history and error display,
- exit handling for help, errors, and explicit `/exit` messages.

The UI persists provider and model selection back to `~/.arguswiki/.env` through `saveArgusWikiEnv()`.

## Credentials and onboarding

This fork's only provider, `claude-cli`, is keyless: it spawns the operator's already-authenticated `claude` CLI binary as a subprocess rather than calling a hosted API with an API key or OAuth token. `src/credentials.tsx` still contains the upstream interactive onboarding flow (provider selection, API key/base-URL/model prompts) as UI scaffolding, but the provider-selection step has nothing to select — `SELECTABLE_ARGUSWIKI_PROVIDERS` is empty in `src/constants.ts`. In practice, the only thing onboarding can still meaningfully prompt for is an optional `LANGSMITH_API_KEY` for tracing (which sets `LANGCHAIN_PROJECT=arguswiki` and `LANGCHAIN_TRACING_V2=true` if provided).

`needsCredentialSetup()` in `src/credentials.tsx` decides whether the setup flow runs at all; see [Credentials and updates](../operations/credentials-and-updates.md) for the full diagnostic/storage picture, including which legacy provider env keys are still tracked for hygiene even though nothing reads them.

## Provider and model selection

`ArgusWikiProvider` in `src/constants.ts` has exactly one member, `claude-cli`, and `PROVIDER_CONFIGS` has exactly one entry. `README.md` and parts of `src/credentials.tsx` still describe the upstream multi-provider table (OpenAI, OpenRouter, Anthropic, Baseten, Fireworks, NVIDIA, OpenAI-compatible, Vertex AI, ChatGPT OAuth) — that table, and the per-provider base-URL/region/API-key setup it implies, does not reflect current source and should not be relied on. The provider fallback chain (picking a provider by whichever API key is set) is also gone; `resolveConfiguredProvider()` now just normalizes `ARGUSWIKI_PROVIDER` and falls back to `DEFAULT_PROVIDER`, both of which resolve to `claude-cli`.

### Claude Code CLI provider

`ARGUSWIKI_PROVIDER=claude-cli` (also the default) runs ArgusWiki against the operator's own already-authenticated `claude` CLI binary as a subprocess instead of calling a hosted API. There is no API key, base URL, or model list to configure — `ARGUSWIKI_MODEL_ID`, if set, is passed through to `claude --model`. It requires the `claude` CLI to be installed and signed in on the machine running ArgusWiki, which makes it a good fit for a self-hosted CI runner under an operator's account rather than the interactive onboarding flow. **It only supports `repository` output mode** — `openwiki personal --init/--update` and the synthesis step of `openwiki ingest` request `local-wiki` mode and currently error because of this (see the caveat above and [Agent workflow: Claude Code CLI provider](../agent/workflow.md#claude-code-cli-provider) for the execution details, including how the docs-only write restriction is enforced for this path).

### Provider retry attempts (inert)

`ARGUSWIKI_PROVIDER_RETRY_ATTEMPTS` is still validated and stored (must be a positive integer, defaults to 3 when unset), but nothing in the current run path applies it — there is no LangChain model client left to configure retries on. The spawned `claude` CLI process either succeeds or the run fails; ArgusWiki does not retry it.

```bash
ARGUSWIKI_PROVIDER_RETRY_ATTEMPTS=3
```

## Help text and validation

The help content is centralized in `src/commands.ts` and is used by the CLI UI. Model validation is intentionally strict:

- model IDs are trimmed,
- they must match the allowed character pattern (`/^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/u`),
- URLs are rejected.

## What to change when editing the CLI

- Update parser behavior in `src/commands.ts` first.
- Then update any user-visible text in `src/cli.tsx` and `README.md` (note: `README.md` currently describes the removed multi-provider stack — verify against `src/constants.ts` before trusting it as a source).
- If new options affect run behavior, make sure `src/agent/index.ts` and `src/credentials.tsx` still receive the right inputs.
- Re-adding a model provider means restoring the removed multi-provider stack (a `createModel()`-equivalent, a LangChain/DeepAgents-based model client, and a `PROVIDER_CONFIGS`/`ArgusWikiProvider` entry in `src/constants.ts`), not just a config edit — there is currently no model-creation branch to extend.
- Re-check the `package.json` bin entry and scripts if the entrypoint changes.

## Source map

- `src/cli.tsx`
- `src/commands.ts`
- `src/credentials.tsx`
- `src/constants.ts`
- `src/env.ts`
- `src/agent/index.ts`
- `src/agent/claude-cli/claude-cli-backend.ts`
- `src/auth/oauth.ts`
- `src/auth/providers.ts`
- `src/auth/configure.ts`
- `src/auth/ngrok.ts`
- `README.md`
- `package.json`
