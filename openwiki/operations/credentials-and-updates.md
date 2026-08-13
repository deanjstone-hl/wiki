---
type: Operations Guide
title: Credentials and updates
description: Operational reference for ArgusWiki local credential storage, onboarding metadata, provider diagnostics, and update tracking. Covers scheduling workflows and CI automation for maintaining ArgusWiki content safely.
tags: [operations, credentials, updates, scheduling, ci]
---

# Credentials and updates

ArgusWiki has four operational concerns that matter for both users and maintainers:

1. local credential storage in `~/.arguswiki/.env`, and
2. persisted personal wiki instructions in `~/.arguswiki/INSTRUCTIONS.md`,
3. persisted onboarding/schedule metadata in `~/.arguswiki/onboarding.json`,
4. persisted update metadata in `openwiki/.last-update.json`.

It also ships with a GitHub Actions workflow example for scheduled updates.

## Installation notes

On Windows, prefer installing ArgusWiki with Node.js package managers such as
`npm` or `pnpm`. The Bun global-install path can fall back to compiling
`better-sqlite3`, which requires Visual Studio Build Tools with the Desktop
development with C++ workload. Bun does not run lifecycle scripts from installed
packages by default, so ArgusWiki cannot show an install-time warning before that
native dependency build begins.

## Local credential storage

`src/env.ts` manages a private environment file under the user's home directory:

- directory: `~/.arguswiki` (mode `0o700`) — overridable by setting `ARGUSWIKI_HOME` before ArgusWiki starts, which also relocates the connectors/wiki/skills subdirectories (`src/arguswiki-home.ts`) and the credentials file below it
- file: `~/.arguswiki/.env` (mode `0o600`), or `$ARGUSWIKI_HOME/.env` when `ARGUSWIKI_HOME` is set

The docs output directory in the target repository is similarly overridable via `ARGUSWIKI_OUTPUT_DIR` (`OPEN_WIKI_DIR` in `src/constants.ts`, defaults to `arguswiki`); this also moves where `.last-update.json` is read and written. **This package's own scheduled workflow explicitly sets `ARGUSWIKI_OUTPUT_DIR: openwiki`** so it keeps writing to the existing, already-committed `apps/wiki/openwiki/` content instead of starting a new `apps/wiki/arguswiki/` directory — `OPEN_WIKI_DIR`'s default changed from `openwiki` to `arguswiki` as part of the OpenWiki→ArgusWiki rename, and without the override the next scheduled run would silently orphan this directory. `ARGUSWIKI_HOME` (the tool's own config/cache home on the machine running it) is not overridden and is unrelated to this per-repo output path.

The file stores model-provider and connector configuration:

- `ARGUSWIKI_PROVIDER` — the selected model provider. This fork has exactly one: `claude-cli` (also the default), which stores nothing here — it is keyless and reuses the operator's already-authenticated `claude` CLI; see [CLI usage: Claude Code CLI provider](../cli/usage.md#claude-code-cli-provider)
- `ARGUSWIKI_MODEL_ID` — passed through to `claude --model` when set
- `ARGUSWIKI_PROVIDER_RETRY_ATTEMPTS` — still validated and stored, but inert (no LangChain model client left to configure retries on); see [Agent workflow: Model errors](../agent/workflow.md#model-errors)
- **Legacy provider keys (managed but unused):** `src/env.ts` still tracks a full set of upstream provider credentials — `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `OPENAI_COMPATIBLE_API_KEY`, `ANTHROPIC_API_KEY`, `BASETEN_API_KEY`, `FIREWORKS_API_KEY`, `NEBIUS_API_KEY`, `NVIDIA_API_KEY`, `GEMINI_API_KEY`, ChatGPT OAuth tokens (`OPENAI_CHATGPT_ACCESS_TOKEN`, `OPENAI_CHATGPT_REFRESH_TOKEN`, `OPENAI_CHATGPT_EXPIRES_AT`, `OPENAI_CHATGPT_ACCOUNT_ID`, `OPENAI_CHATGPT_EMAIL`, `OPENAI_CHATGPT_PLAN`), Bedrock AWS credentials, base URLs (`ANTHROPIC_BASE_URL`, `OPENAI_COMPATIBLE_BASE_URL`), and Google Cloud settings (`GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `GOOGLE_APPLICATION_CREDENTIALS`) — for env-file hygiene and diagnostics display only. None of these are read by the current single-provider runtime; only `claude-cli` in `PROVIDER_CONFIGS` is active.
- Connector OAuth credentials (still active, unrelated to model providers): `ARGUSWIKI_GMAIL_ACCESS_TOKEN`, `ARGUSWIKI_GMAIL_REFRESH_TOKEN`, `ARGUSWIKI_GOOGLE_CLIENT_ID`, `ARGUSWIKI_GOOGLE_CLIENT_SECRET`, `ARGUSWIKI_NOTION_MCP_ACCESS_TOKEN`, `ARGUSWIKI_NOTION_MCP_CLIENT_ID`, `ARGUSWIKI_NOTION_MCP_REFRESH_TOKEN`, `ARGUSWIKI_SLACK_USER_TOKEN`, `ARGUSWIKI_SLACK_CLIENT_ID`, `ARGUSWIKI_SLACK_CLIENT_SECRET`, `ARGUSWIKI_X_ACCESS_TOKEN`, `ARGUSWIKI_X_CLIENT_ID`, `ARGUSWIKI_X_CLIENT_SECRET`, `ARGUSWIKI_X_REFRESH_TOKEN`
- Connector API keys: `TAVILY_API_KEY` for Web Search
- Optional LangSmith settings: `LANGSMITH_API_KEY`, `LANGCHAIN_PROJECT`, `LANGCHAIN_TRACING_V2`
- Optional OAuth callback settings: `ARGUSWIKI_OAUTH_CALLBACK_PORT` controls the
  local callback port, and `ARGUSWIKI_HTTPS_OAUTH_REDIRECT_URI` stores the
  Slack-only HTTPS callback URL created by `openwiki ngrok start`.

The loader merges those values into `process.env`, while preferring existing process-level values over file values. Deprecated keys (`OPENAI_BASE_URL`, `OPENAI_ORG_ID`, `OPENAI_PROJECT`) are skipped on load and removed on save.

Values containing newlines or carriage returns are serialized as double-quoted strings with `\n`, `\r`, `\\`, and `\"` escaped by `formatEnvValue()`, and unescaped on load by `parseEnvValue()`. Carriage return escaping is important on Windows, where multi-line env values can contain bare `\r` characters that would otherwise be silently stripped during round-trip serialization.

Slack OAuth can require an HTTPS redirect URL, so `openwiki ngrok start <url>`
saves `ARGUSWIKI_HTTPS_OAUTH_REDIRECT_URI`. Other connector OAuth flows, such as
X/Twitter and Gmail, ignore that HTTPS override and use the local loopback
callback `http://127.0.0.1:<port>/callback`.

Gmail OAuth saves a read-only access token and refresh token. After
`openwiki auth gmail`, the Google connector is ready for direct Gmail API
ingestion without an MCP transport. By default it queries `newer_than:1d` and
writes `gmail-messages.json` under `~/.arguswiki/connectors/google/raw/<run-id>/`.

Web Search uses Tavily through LangChain. First-run onboarding asks for
`TAVILY_API_KEY`, stores it in `~/.arguswiki/.env`, and writes configured search
queries to `~/.arguswiki/connectors/web-search/config.json`.

Hacker News uses public read-only APIs and does not require credentials. The
connector can fetch top/new/best/show/ask/job feeds and configured search
queries.

`src/credentials.tsx` still contains the interactive bootstrap flow from the upstream multi-provider version — provider selection, API key/model prompts, LangSmith key — but with `SELECTABLE_ARGUSWIKI_PROVIDERS` empty and the sole provider (`claude-cli`) keyless, there is nothing left to prompt for except the optional LangSmith key. `needsCredentialSetup()` still gates whether the flow runs at all. Deprecated OpenAI-related environment variables (`OPENAI_ORG_ID`, `OPENAI_PROJECT`) are still stripped on save.

The setup flow runs for **all** interactive commands (chat, init, and update) when it decides setup is needed — not just chat. In non-interactive mode (no TTY or `--print`), a genuinely missing required value produces an error instead of a prompt.

## First-run onboarding profile

> **Personal/local-wiki mode currently errors at run time.** The rest of this section (templates, connector onboarding, `onboarding.json`, local schedules) describes machinery that still exists and still runs for *deterministic* connector ingestion, but the wiki-*synthesis* step — and all of `openwiki personal --init/--update` — goes through `runClaudeCliAgent()`, which unconditionally rejects `local-wiki` output mode. See [Agent workflow: Claude Code CLI provider](../agent/workflow.md#claude-code-cli-provider) and [CLI usage](../cli/usage.md#credentials-and-onboarding).

After model setup, first-run onboarding lets the user choose one of five wiki
templates: Personal Work OS, AI Research Radar, Git Project Wiki, Social Media

- Market Briefing, or Engineering Memory. Users can also choose Custom. The
  template seeds the wiki scope prompt, and the user can edit it before saving.

Onboarding then walks through source connections for local Git repositories,
Notion, Gmail, X/Twitter, Web Search, and Hacker News. Non-secret setup
preferences are stored in `~/.arguswiki/onboarding.json`:

- the selected template ID/name,
- which sources have been connected,
- optional per-source ingestion guidance,
- per-source cron expressions and plain-English schedule descriptions,
- macOS LaunchAgent paths when schedule installation succeeds,
- optional macOS `pmset` wake/sleep window metadata.

The user's global personal wiki scope/intent is stored as Markdown in
`~/.arguswiki/INSTRUCTIONS.md` so it can be edited directly.

OAuth tokens and client secrets are not stored in this file. They remain in
`~/.arguswiki/.env`.

## Local schedules

Source schedules are validated with `cron-parser` and described with
`cronstrue`. On macOS, ArgusWiki installs simple cron schedules as a single
shared user LaunchAgent at `~/Library/LaunchAgents/com.arguswiki.ingestion.plist`
(one plist covers all configured source schedules, not one per source). The
plist runs `openwiki --update --print` from the setup working directory and
writes logs under `~/.arguswiki/logs/`.

LaunchAgent plists never embed secret values. Complex cron expressions that
cannot be represented directly as `StartCalendarInterval` are saved in the
onboarding profile with a warning instead of being installed inaccurately.

After saving a source cron, onboarding can also configure a Mac wake window with
`pmset`. ArgusWiki computes a shared window across currently saved source
schedules: wake 2 minutes before the earliest supported schedule, then sleep 30
minutes after the latest supported schedule. The setup uses the macOS
administrator prompt because changing `pmset` repeat schedules is a system power
setting.

`pmset` is a single machine-level repeat schedule, not a per-source scheduler.
Setting it from ArgusWiki may replace an existing repeat wake/sleep schedule. If
the Mac is closed, powered off, out of battery, or the cron expression cannot be
represented as a simple daily/weekly wake window, ArgusWiki saves the source cron
and records a warning instead of installing an inaccurate power schedule.

Saved local schedules can be managed from the CLI:

- `openwiki cron list` shows saved connector schedules, launchd state, and the
  saved Mac wake window.
- `openwiki cron pause <source|all>` unloads the matching launchd job(s), keeps
  the cron metadata, and reconciles the shared `pmset` wake window.
- `openwiki cron resume <source|all>` reinstalls paused launchd job(s) from the
  saved cron metadata and reconciles the shared `pmset` wake window.
- `openwiki cron delete <source|all>` unloads the matching launchd job(s),
  removes the ArgusWiki LaunchAgent plist(s), deletes only the schedule metadata,
  and reconciles the shared `pmset` wake window. It does not remove connector
  auth, connector config, raw data, or wiki content.

When pause or delete leaves no active ArgusWiki schedules, ArgusWiki cancels the
saved repeat `pmset` schedule and marks the saved wake window disabled.

## Provider resolution

`resolveConfiguredProvider()` in `src/constants.ts` is now a two-step fallback with only one possible outcome:

1. If `ARGUSWIKI_PROVIDER` is set and valid, use it.
2. Otherwise, fall back to `DEFAULT_PROVIDER`.

Both `ARGUSWIKI_PROVIDER=claude-cli` and `DEFAULT_PROVIDER` resolve to `"claude-cli"` — the only member of `ArgusWikiProvider`. The old fallback-by-API-key chain (OpenAI, OpenAI-compatible, OpenRouter, Anthropic, Baseten, Fireworks, NVIDIA) no longer exists in source.

`needsCredentialSetup()` in `src/credentials.tsx` checks whether the provider env var is valid and whether the provider's required credentials (`getMissingProviderEnvKey()` in `src/constants.ts` — always `null` for the keyless `claude-cli` provider), a model ID (unless overridden), and a LangSmith key are all present. In practice only a missing LangSmith key or an explicitly invalid `ARGUSWIKI_PROVIDER` value can still trigger the interactive flow.

## Model and credential diagnostics

The env layer also produces diagnostics for the CLI UI. Those diagnostics report:

- where each credential came from (`process.env`, `~/.arguswiki/.env`, both, or `unset`),
- whether the value is unset,
- the apparent length,
- a masked preview,
- warnings for suspicious formatting such as whitespace, newlines, quotes, or bracketed suffixes,
- invalid model IDs,
- invalid provider values.

Diagnostics still cover every managed key from `src/env.ts` — including the legacy provider keys described above (OpenAI, OpenRouter, Anthropic, Baseten, Fireworks, NVIDIA, ChatGPT OAuth, base URLs, Google Cloud settings) even though none of them are read by the active `claude-cli` provider — plus `ARGUSWIKI_PROVIDER`, `ARGUSWIKI_MODEL_ID`, `ARGUSWIKI_PROVIDER_RETRY_ATTEMPTS`, connector credentials, and `LANGSMITH_API_KEY`. This makes startup problems and leftover configuration easier to diagnose without exposing secret values (non-secret values such as the provider, model ID, and retry attempts are shown in full).

## Update metadata

After successful `init` or `update` runs where the `openwiki/` content changed, `src/agent/utils.ts` writes `openwiki/.last-update.json` with:

- `updatedAt`
- `command`
- `gitHead`
- `model`

The content-change check uses `createArgusWikiContentSnapshot()`, which hashes the `openwiki/` directory (excluding `.last-update.json`). If the hash is identical before and after the run, metadata is not written. This prevents scheduled update loops from updating the timestamp when no documentation changed.

Update runs use this metadata to build a change summary since the previous successful ArgusWiki execution — preferring `gitHead` for a precise commit range, falling back to `updatedAt` for a time-based range.

## Scheduled CI workflows

The repository includes `examples/arguswiki-update.yml` as a copyable GitHub Actions scheduled update workflow. It:

- runs on schedule (daily at 08:00 UTC) and on manual dispatch,
- checks out the repository,
- installs Node.js 22,
- installs ArgusWiki globally,
- runs `arguswiki code --update --print` with `ARGUSWIKI_PROVIDER: claude-cli` set — no API key or GitHub secrets are passed for model access; the runner needs an already-installed, already-authenticated `claude` CLI instead (the example workflow itself does not install one),
- classifies the resulting `arguswiki/` diff as **structural** or **routine**,
- opens a pull request with `peter-evans/create-pull-request` scoped to the `openwiki` directory, `AGENTS.md`, `CLAUDE.md`, and the workflow file itself, with the classification and reason in the PR body,
- auto-merges the PR (`gh pr merge --auto --squash`) only when the classification is routine.

The classification step treats a change as **structural** — left for manual review — when it touches the workflow file itself, adds new file(s) under `arguswiki/`, adds a new `##`/`###` heading, or changes a markdown link; everything else (prose-only edits to existing pages) is **routine** and auto-merges. The workflow file is force-classified structural unconditionally, so a change to the automation itself can never be silently auto-merged even though it stays in `add-paths` to support first-time setup. `examples/arguswiki-update.yml` itself now also sets `ARGUSWIKI_PROVIDER: claude-cli` (no provider secrets passed) — it no longer defaults to a hosted-API provider like `openrouter`. This package's own scheduled workflow, `.github/workflows/wiki-arguswiki-update.yml`, lives at the monorepo root (not inside this package) and sets `working-directory: apps/wiki`; it runs the identical classify/auto-merge logic against a self-hosted runner (which is what makes an already-authenticated `claude` CLI available), and scopes its `add-paths` to `apps/wiki/openwiki`, `apps/wiki/AGENTS.md`, `apps/wiki/CLAUDE.md`, and the workflow file itself. It also sets `ARGUSWIKI_OUTPUT_DIR: openwiki` explicitly — see the note above about why that override exists.

The workflow is a good reference for automated maintenance. The monorepo's `.github/workflows/ci.yml` also runs a `wiki` job against this package (typecheck, lint, build, a CLI smoke test — `node dist/cli.js code --dry-run --init` with `ARGUSWIKI_DEV=1` — and tests) plus a sibling `wiki-audit` job that runs a Trivy dependency scan (`scan-ref: apps/wiki`, `severity: HIGH,CRITICAL`, `exit-code: 1`) and uploads the SARIF results. (This `ARGUSWIKI_DEV` env var name is a common source of drift: it was `OPENWIKI_DEV` until the OpenWiki→ArgusWiki rename, and CI's use of the env var must stay in sync with `isDevelopmentMode()` in `src/commands.ts`.)

## Things to watch when changing operations

- The `.env` file lives outside the repository, so changes to its format should be conservative.
- Never document real secret values; only document the presence and purpose of the configuration.
- If update metadata semantics change, update both the agent runtime and the docs that explain how update runs are scoped.
- Scheduled automation depends on the same CLI entrypoint as local users, so workflow changes should be validated against `package.json` and the CLI help text.
- Re-adding a model provider means restoring the removed multi-provider stack (see [CLI usage: Provider and model selection](../cli/usage.md#provider-and-model-selection)), not a small config edit — there is no active `createModel`-equivalent to extend.
- The content-snapshot check means CI runs that produce no changes will not update `.last-update.json` or open a PR with metadata-only changes.
- Personal/local-wiki mode (onboarding templates, connector synthesis, local schedules) is documented below as designed, but the synthesis half currently errors under the claude-cli-only provider — see the caveat above.

## Source map

- `src/env.ts`
- `src/arguswiki-home.ts`
- `src/credentials.tsx`
- `src/constants.ts`
- `src/agent/utils.ts`
- `src/agent/index.ts`
- `src/agent/claude-cli/claude-cli-backend.ts`
- `src/auth/oauth.ts`
- `src/auth/providers.ts`
- `src/auth/configure.ts`
- `src/auth/tokens.ts`
- `src/onboarding.ts`
- `src/schedules.ts`
- `src/code-mode.ts`
- `examples/arguswiki-update.yml`
- `.github/workflows/wiki-arguswiki-update.yml` (monorepo root)
- `.github/workflows/ci.yml` (monorepo root)
- `README.md`
