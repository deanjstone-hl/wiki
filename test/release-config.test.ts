import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const releaseConfigPath = path.resolve(
  import.meta.dirname,
  "../.releaserc.json",
);

type PluginEntry = string | [string, Record<string, unknown>];

const loadPlugins = (): PluginEntry[] =>
  (
    JSON.parse(readFileSync(releaseConfigPath, "utf8")) as {
      plugins: PluginEntry[];
    }
  ).plugins;

describe(".releaserc.json", () => {
  // The first Release run on `deploy` (wiki#4) tagged and published v1.0.0, then the run
  // failed: @semantic-release/github's success step comments on every issue or pull
  // request a released commit mentions, and throws on a number that does not exist in
  // this repo. This repo's history is the split-out apps/wiki history, so it mentions
  // argus numbers such as #187 to #189. A release that has already been published must
  // not end red.
  test("turns off the success and fail comments of @semantic-release/github", () => {
    const entry = loadPlugins().find(
      (plugin) =>
        Array.isArray(plugin) && plugin[0] === "@semantic-release/github",
    );
    expect(entry, "the github plugin must carry options").toBeDefined();
    const options = (entry as [string, Record<string, unknown>])[1];
    expect(options.successComment).toBe(false);
    expect(options.failComment).toBe(false);
  });

  test("keeps the plugin set that only analyses, tags and publishes", () => {
    const names = loadPlugins().map((plugin) =>
      Array.isArray(plugin) ? plugin[0] : plugin,
    );
    expect(names).toEqual([
      "@semantic-release/commit-analyzer",
      "@semantic-release/release-notes-generator",
      "@semantic-release/github",
    ]);
  });
});
