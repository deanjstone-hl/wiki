# ArgusWiki

> This package is a hard fork of [langchain-ai/openwiki](https://github.com/langchain-ai/openwiki), living in `deanjstone-hl/wiki` (split out of [`deanjstone/argus`](https://github.com/deanjstone/argus) `apps/wiki`, full history kept). It carries no live upstream tracking — see [`CLAUDE.md`](CLAUDE.md) for fork status and local divergences. All credit for the original design and implementation goes to the langchain-ai/openwiki authors; this fork does not contribute changes back upstream.

ArgusWiki is a CLI that writes and maintains agent wikis for codebases or purpose memory. It's built specifically for agents, can ingest local knowledge sources through built-in connectors or git repositories and synthesize them into a local wiki.

<div align="center">
  <a href="https://trendshift.io/repositories/70339?utm_source=trendshift-badge&amp;utm_medium=badge&amp;utm_campaign=badge-trendshift-70339" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/70339/daily" alt="langchain-ai%2Fopenwiki | Trendshift" width="250" height="55"/></a>
</div>

![OpenWiki](https://raw.githubusercontent.com/langchain-ai/openwiki/main/static/openwiki.png)

## Install

```sh
npm install -g arguswiki
```

On Windows, prefer installing ArgusWiki with Node.js package managers such as
`npm` or `pnpm`:

```sh
npm install -g arguswiki
# or
pnpm add -g arguswiki
```

`bun install -g arguswiki` can fall back to compiling ArgusWiki's `better-sqlite3`
checkpointing dependency. Before using that path, install Visual Studio Build
Tools with the Desktop development with C++ workload. Bun does not run lifecycle
scripts from installed packages by default, so it cannot display a package-level
warning before that native dependency build starts.

## Quick Start

Initialize ArgusWiki in code mode, configure your model and API key, then generate documentation:

```sh
arguswiki --init
```

ArgusWiki has two modes:

- **Personal mode** builds a local personal brain wiki in `~/.arguswiki/wiki` from
  configured sources like local repositories, Gmail, Notion, Web Search, Hacker
  News, and X/Twitter.
- **Code mode** builds repository documentation in `arguswiki/` for the current
  codebase.

Bare `arguswiki --init` and `arguswiki --update` run in code mode. Use
`arguswiki personal --init` or `arguswiki personal --update` for the local
personal brain wiki.

Then to ensure your documentation stays up-to-date, add the CI workflow for your Git provider to automatically open a PR or merge request with documentation updates:

- GitHub Actions: copy [arguswiki-update.yml](./examples/arguswiki-update.yml) into `.github/workflows/arguswiki-update.yml`.

For repository documentation in GitHub Actions, use
`arguswiki code --update --print`. You do not need to run `--init` in CI:
`--update` will create the initial `arguswiki/` docs if they do not exist yet, as
long as the workflow provides the required provider and model environment
variables.

## Usage

Start the interactive CLI in code mode for the current repository:

```sh
arguswiki
```

Start ArgusWiki with an initial request:

```sh
arguswiki "Please generate documentation for this repository"
```

Start the interactive local personal brain instead:

```sh
arguswiki personal
```

Run a single command and exit:

```sh
arguswiki -p "Summarize what you can do"
```

Initialize ArgusWiki:

```sh
arguswiki --init
```

Initialize the local personal brain wiki:

```sh
arguswiki personal --init
```

Update repository code documentation:

```sh
arguswiki --update
```

Update the local personal brain wiki:

```sh
arguswiki personal --update
```

Run an update that can ingest configured local connectors first:

```sh
arguswiki personal --update "Refresh the wiki from configured connectors"
```

Show help:

```sh
arguswiki --help
```

In chat, use `/api-key` to update the current provider API key and
`/langsmith-key` to update or clear LangSmith tracing credentials. Both commands
use masked prompts.

Authenticate a connector provider:

```sh
arguswiki auth slack
arguswiki auth gmail
arguswiki auth x
arguswiki auth notion
```

Start an ngrok tunnel for Slack OAuth:

```sh
arguswiki ngrok start
```

This starts ngrok with a random HTTPS forwarding URL. ArgusWiki reads ngrok's
local inspection API, appends `/callback`, and saves
`ARGUSWIKI_HTTPS_OAUTH_REDIRECT_URI` automatically. Register the printed callback
URL in Slack. If you have a fixed ngrok domain, run
`arguswiki ngrok start https://<your-ngrok-domain>`. X/Twitter and Gmail auth
ignore that HTTPS override and keep using the local loopback callback,
`http://127.0.0.1:53682/callback`.

Bare `arguswiki` runs in code mode for the current repository. It creates initial repository documentation in `arguswiki/` when no wiki exists. Use `arguswiki personal` for the local general-purpose wiki in `~/.arguswiki/wiki/`. By default, the CLI stays open after each run so you can send follow-up messages. Use `-p` or `--print` for a one-shot non-interactive run that prints the final assistant output.

Bare `arguswiki --init` and `arguswiki --update` default to code mode and operate on repository documentation. Use the `personal` positional mode or `--mode personal` to initialize or update the local personal brain wiki.

On each `code` run, `arguswiki` maintains both an `AGENTS.md` and a `CLAUDE.md` at the repository root, adding prompting that instructs your coding agent to reference the wiki when searching for context. Each file is created if it does not already exist. If a file is present, ArgusWiki only rewrites its own `<!-- ARGUSWIKI:START -->…<!-- ARGUSWIKI:END -->` block and leaves the rest of your content untouched (appending the block the first time). The scheduled GitHub Actions workflow includes these files, along with the workflow itself, in the documentation pull request.

Repository-specific wiki instructions are stored separately in
`arguswiki/INSTRUCTIONS.md`. This file is a shared, user-authored brief for the
repository wiki: ArgusWiki reads it for scope and priorities, but it is not
generated documentation and is not rewritten during normal init, update, or chat
runs unless you explicitly ask to change the brief.

On the first interactive run, ArgusWiki will have you configure your inference provider, API key, and LLM. You will also be able to set a LangSmith API key to trace your ArgusWiki runs to a LangSmith tracing project named "arguswiki" (optional).

These configuration options and secrets will be saved to `~/.arguswiki/.env` on your local machine.

## Local Connectors

ArgusWiki's first-run onboarding offers connector setup for local Git repositories, Notion, Gmail, X/Twitter, Web Search, and Hacker News. During an ingestion run, deterministic connector tools write raw data and manifests under `~/.arguswiki/connectors/<connector>/raw/`, then source-specific agent runs synthesize the local wiki under `~/.arguswiki/wiki/` from those local files.

You can configure the same connector more than once. For example, add one Web
Search source for AI research and another for NBA news; ArgusWiki stores them as
separate source instances such as `web-search-1` and `web-search-2`. Run all
instances with `arguswiki ingest all`, all instances for one connector with
`arguswiki ingest web-search`, or one instance with
`arguswiki ingest web-search-2`.

- `git-repo` reads configured local repository paths and writes compact manifests.
- `x` uses the X API directly with OAuth user-context credentials for home timeline, user posts, mentions, bookmarks, and list posts.
- `notion` targets the hosted Notion MCP server, so users should authenticate through Notion OAuth instead of pasting a Notion token into ArgusWiki.
- `google` uses the Gmail API directly with OAuth user credentials to fetch recent mail, with room to add Drive, Calendar, and other Google providers later.
- `web-search` uses Tavily through LangChain and requires `TAVILY_API_KEY`.
- `hackernews` uses public Hacker News feed and search APIs, with no credentials required.

Connector secrets are referenced by env var name and stored in `~/.arguswiki/.env`; connector config files should never contain raw secret values.

`arguswiki auth <provider>` runs a local browser OAuth flow, saves returned tokens into `~/.arguswiki/.env`, creates connector config when possible, and discovers MCP tools for MCP-backed providers. Slack and Gmail require app client credentials to already be set in that file; Notion uses dynamic client registration for hosted MCP; X uses OAuth 2.0 with PKCE. After `arguswiki auth gmail`, the Google connector can ingest Gmail directly with no MCP transport setup.

`arguswiki auth configure <provider>` and `arguswiki auth tools <provider>` are advanced/retry commands for regenerating connector config or inspecting live MCP tools.

First-run onboarding also lets users choose a wiki template, customize its scope,
and save per-source ingestion notes and source schedules in
`~/.arguswiki/onboarding.json`. The global personal wiki instructions are saved
in `~/.arguswiki/INSTRUCTIONS.md`. On macOS, source schedules are installed as
user LaunchAgents under `~/Library/LaunchAgents/` and write logs under
`~/.arguswiki/logs/`.

See the ArgusWiki operations docs for credential storage and provider setup
notes.

## Customizing

ArgusWiki supports OpenAI (with an API key or a ChatGPT login), OpenRouter, Gemini (AI Studio), Gemini Enterprise (Vertex AI), Nebius Token Factory, Fireworks, Baseten, NVIDIA NIM, an OpenAI-compatible provider, AWS Bedrock, and Anthropic out of the box. The onboarding default is OpenAI with `gpt-5.6-terra`, and each inference provider also includes pre-defined model options plus support for custom model IDs.

### Alternative base URLs

To route the Anthropic provider at an alternative, Anthropic-compatible endpoint
(for example a self-hosted or proxied gateway) instead of the default API, set
`ANTHROPIC_BASE_URL` alongside `ANTHROPIC_API_KEY`:

```bash
ARGUSWIKI_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-key
ANTHROPIC_BASE_URL=https://your-gateway.example.com/anthropic
```

### OpenAI-compatible endpoints

The `openai-compatible` provider targets any OpenAI-compatible chat-completions
endpoint via a required base URL. This can be used for OpenAI-compatible LLM
endpoints like those exposed by a LiteLLM gateway when it is used as a gateway —
letting you reach whatever upstream providers the gateway fronts through a single
OpenAI-shaped API. Set the model ID to whatever name the gateway exposes:

```bash
ARGUSWIKI_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_API_KEY=your-gateway-key
OPENAI_COMPATIBLE_BASE_URL=https://your-gateway.example.com/v1
ARGUSWIKI_MODEL_ID=your-gateway-model-name
```

### AWS Bedrock

The `bedrock` provider calls foundation models hosted on AWS Bedrock using IAM
credentials rather than a single vendor API key. It authenticates with an AWS
access key ID, a secret access key, and a region:

```bash
ARGUSWIKI_PROVIDER=bedrock
BEDROCK_AWS_ACCESS_KEY_ID=your-access-key-id
BEDROCK_AWS_SECRET_ACCESS_KEY=your-secret-access-key
BEDROCK_AWS_REGION=us-east-1
ARGUSWIKI_MODEL_ID=anthropic.claude-sonnet-5
```

Which model IDs are available depends on your AWS account and region (which
foundation models you've enabled in the Bedrock console), so there is no
preset model list — paste the Bedrock model ID directly, as shown above.

Some newer models only accept on-demand invocation through a cross-region
inference profile rather than their bare model ID — if you see `ValidationException:
Invocation of model ID ... with on-demand throughput isn't supported`, prefix
the model ID with the profile's region code instead, for example
`us.anthropic.claude-sonnet-5`. Your IAM policy also needs to allow
`bedrock:InvokeModel`/`InvokeModelWithResponseStream` on both the
`foundation-model` and `inference-profile` resource types in that case.

### OpenAI (ChatGPT login)

The `openai-chatgpt` provider calls OpenAI's Codex backend using your ChatGPT
subscription instead of a metered API key. Model usage draws on your ChatGPT
Plus/Pro/Team plan's included Codex usage rather than per-token API billing. It
serves the same model list as the `openai` provider.

Instead of pasting an API key, run the setup wizard and complete a browser
login:

```bash
ARGUSWIKI_PROVIDER=openai-chatgpt arguswiki code --init
# or
ARGUSWIKI_PROVIDER=openai-chatgpt arguswiki personal --init
```

The wizard opens `https://auth.openai.com` in your browser (and also prints the
URL for headless/SSH use, where you can open it on another machine — or paste the
redirect URL back into the terminal to finish without a callback). After you sign
in with your ChatGPT account, ArgusWiki captures the OAuth callback, shows the
signed-in email and plan, and then continues to model and LangSmith selection
just like the other providers. It stores the resulting access token, refresh
token, expiry, account id, email, and plan in `~/.arguswiki/.env`
(`OPENAI_CHATGPT_ACCESS_TOKEN`, `OPENAI_CHATGPT_REFRESH_TOKEN`,
`OPENAI_CHATGPT_EXPIRES_AT`, `OPENAI_CHATGPT_ACCOUNT_ID`, `OPENAI_CHATGPT_EMAIL`,
`OPENAI_CHATGPT_PLAN`). These are managed for you — the access token is refreshed
automatically when it expires, so you normally never edit them by hand. Treat the
refresh token like a password.

### Gemini (AI Studio)

The `gemini` provider runs Google's Gemini models through the AI Studio API with
a single API key:

```bash
ARGUSWIKI_PROVIDER=gemini
GEMINI_API_KEY=your-ai-studio-key
```

### Gemini Enterprise (Vertex AI)

The `gemini-enterprise` provider runs models from the Gemini Enterprise Model
Garden (formerly Vertex AI) — Google's own Gemini/Gemma models, Anthropic's
Claude, and partner/open-weight models (Llama, Mistral, DeepSeek, Qwen, …). It
routes each model ID to the right API surface automatically, so one credential
reaches all of them. It uses no API key — authentication happens with Google
Application Default Credentials (ADC), so any of the standard mechanisms work:

- a service account key file via `GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json`,
- user credentials from `gcloud auth application-default login`, or
- workload identity when running on Google Cloud (GKE, Cloud Run, GCE) or in CI.

```bash
ARGUSWIKI_PROVIDER=gemini-enterprise
GOOGLE_CLOUD_PROJECT=your-gcp-project
GOOGLE_CLOUD_LOCATION=global   # optional, defaults to global
```

Set `ARGUSWIKI_MODEL_ID` to any Model Garden model. Gemini and Claude ship as
preset options; partner/open-weight models are reached by pasting their model ID
(for example `publishers/meta/models/llama-3.3-70b-instruct-maas`).

The credentials used need Vertex AI access (`roles/aiplatform.user`) in the
project, and the models you want must be enabled in the Model Garden. The
`global` endpoint serves Gemini and Claude and offers the best availability;
regional endpoints (for example `europe-west1` or `us-east5`) can be set via
`GOOGLE_CLOUD_LOCATION` for data-residency requirements. Partner/open-weight
(MaaS) models are region-specific, so set `GOOGLE_CLOUD_LOCATION` explicitly when
using them.

Note that `GOOGLE_CLOUD_PROJECT` (and `GOOGLE_APPLICATION_CREDENTIALS`, if you
choose to store it there) is persisted to `~/.arguswiki/.env` and loaded into the
ArgusWiki process environment at startup when not already set — values already
present in your shell always win.

For CI, authenticate before the update job runs — for example with
[`google-github-actions/auth`](https://github.com/google-github-actions/auth)
(workload identity federation) in GitHub Actions — and set
`ARGUSWIKI_PROVIDER=gemini-enterprise` and `GOOGLE_CLOUD_PROJECT` in the job
environment.

Base URLs (and all credentials) can be set in your environment or stored in `~/.arguswiki/.env`.

### Provider retry attempts

ArgusWiki uses LangChain's built-in retry handling for transient provider errors.
To override the number of retries after the first provider request, set `ARGUSWIKI_PROVIDER_RETRY_ATTEMPTS`:

```bash
ARGUSWIKI_PROVIDER_RETRY_ATTEMPTS=3
```

The value must be a positive integer. If the value is unset, ArgusWiki defaults to 3 retries.

If there's an inference provider or model you'd like to see added, please open a PR!

## Checks and pushing

Trunk-based development: small conventional commits straight to `main`, no branch, no pull request. Before every push run `pnpm check` (it runs `scripts/ci.sh`: install, typecheck, lint, format, build, smoke test, unit tests, shell syntax), then `git pull --rebase`, then push. CI runs the same script on every push to `main`.

## Releases and promotion

A version is cut only when the owner promotes `main` to the `deploy` branch (the Approve on the ops-hub promotion card, a fast-forward of `deploy` to a SHA already on `main`). A merge to `main` never releases.

Each push to `deploy` runs the **Release** workflow (`.github/workflows/release.yml`), two jobs in order:

1. **Test before release (typecheck, lint, build, unit tests)** runs `scripts/ci.sh`, the same gate as the pull request CI, on the promoted commit.
2. **Release** needs the test job, so a red test means no version. semantic-release tags one version and publishes the GitHub Release notes (through `scripts/release-with-retry.sh`, which redoes a rejected tag push up to 3 times); it commits nothing back to `deploy`. A promotion made only of chore, docs, ci, test or refactor commits releases nothing.

`workflow_dispatch` re-runs a failed release, and refuses any ref but `deploy`. Wiki is a CLI with no host install, so a promotion runs no deploy script.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR. We intentionally keep PRs tightly scoped to one change each, and PRs that bundle unrelated changes may be closed with a request to split them.
