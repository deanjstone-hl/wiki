# [@argus/wiki-v2.0.1](https://github.com/deanjstone/argus/compare/@argus/wiki-v2.0.0...@argus/wiki-v2.0.1) (2026-10-10)


### Bug Fixes

* **wiki:** raise vitest timeout for loaded CI runners ([#588](https://github.com/deanjstone/argus/issues/588)) ([#624](https://github.com/deanjstone/argus/issues/624)) ([cd2fc16](https://github.com/deanjstone/argus/commit/cd2fc167a345b55336144eb1aae97ef98a6679fc))

# [@argus/wiki-v2.0.0](https://github.com/deanjstone/argus/compare/@argus/wiki-v1.0.1...@argus/wiki-v2.0.0) (2026-08-10)


* Rename OpenWiki identifiers and env vars to ArgusWiki in src ([#197](https://github.com/deanjstone/argus/issues/197)) ([ae2be6b](https://github.com/deanjstone/argus/commit/ae2be6bcaefe7febfc98c231bb9a06130b963b03)), closes [#187](https://github.com/deanjstone/argus/issues/187) [#188](https://github.com/deanjstone/argus/issues/188)


### BREAKING CHANGES

* env var names changed (e.g. OPENWIKI_PROVIDER ->
ARGUSWIKI_PROVIDER, OPENWIKI_DEV -> ARGUSWIKI_DEV, OPENWIKI_HOME ->
ARGUSWIKI_HOME). Anyone with old env var names set externally (systemd
units, CI secrets, .env files) must update them.

# [@argus/wiki-v1.0.1](https://github.com/deanjstone/argus/compare/@argus/wiki-v1.0.0...@argus/wiki-v1.0.1) (2026-08-09)


### Bug Fixes

* **release:** disable @semantic-release/github success/fail comments ([#195](https://github.com/deanjstone/argus/issues/195)) ([f8700a7](https://github.com/deanjstone/argus/commit/f8700a7623cba507bb22998fb83df0b8930c187b))

# @argus/wiki-v1.0.0 (2026-08-09)


### Bug Fixes

* **release:** declare semantic-release deps in mcp-server and wiki ([#194](https://github.com/deanjstone/argus/issues/194)) ([7c9b701](https://github.com/deanjstone/argus/commit/7c9b701709cc91d47a7251e6cfcbf9487f1466d0))
