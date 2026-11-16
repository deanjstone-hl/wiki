# Diagrams

Three self-contained HTML/SVG diagrams for `wiki`: its architecture, its main flow, and its build and deploy path. Drawn in the house style of [argus-config/docs/diagrams](https://github.com/deanjstone/argus-config/tree/main/docs/diagrams) with the [diagram-design](https://github.com/cathrynlavery/diagram-design) Claude Code plugin checks (map [argus-config#1433](https://github.com/deanjstone/argus-config/issues/1433), task [context#453](https://github.com/deanjstone/context/issues/453)). Open the `.html` file in a browser.

Each step node is a `<g id="step-<flow>-<step>">`, the deep-link contract of [ops-hub#13](https://github.com/deanjstone/ops-hub/issues/13): the hub links `#/diagrams/<repo>/<path>#<step-id>`, and the page highlights the targeted step (`:target`). Anything inferred is marked `[speculation]` in the diagram or its source line.

| Diagram | Type | Flow | Step ids | Sources |
|---|---|---|---|---|
| [`architecture.html`](architecture.html) | Architecture | `wiki` | `cli` `modes` `agent` `connectors` `auth` `output` `update` `audit` | README.md, CLAUDE.md (Fork status, Local divergence), src/, .github/workflows/ |
| [`update-flow.html`](update-flow.html) | Flow | `wikirun` | `start` `mode` `ingest` `agent` `write` `blocks` `pr` | README.md (Usage, Local Connectors), CLAUDE.md, .github/workflows/arguswiki-update.yml, src/ingestion.ts. |
| [`build-deploy.html`](build-deploy.html) | Pipeline | `wikirel` | `push` `ci` `approve` `test` `release` `install` | scripts/ci.sh, .github/workflows/ (ci.yml, release.yml, audit.yml), scripts/release-with-retry.sh, README.md (Checks and pushing, Releases and promotion). |

## Not drawn

The update workflow's enabled state, per-connector wiring beyond the file names, and the `openwiki/` self-generated docs.

## Network

The diagrams use the system font stack and make no network request. They name services and roles, never addresses or ids.

## Redrawing

The diagrams are hand-checked against their sources, not generated from them. After the sources change, redraw and rerun the plugin's checks: `self_check.py` in the skill directory and `verify-geometry.py` in the plugin's `scripts/`.
