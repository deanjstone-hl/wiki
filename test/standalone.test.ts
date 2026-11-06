import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });

describe("wiki stands alone outside the argus monorepo", () => {
  const manifest = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8"),
  ) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  it("depends on no workspace or linked package", () => {
    const specifiers = Object.entries({
      ...manifest.dependencies,
      ...manifest.devDependencies,
    });
    const local = specifiers.filter(([, version]) =>
      /^(workspace|link|file):/.test(version),
    );
    expect(local).toEqual([]);
  });

  it("imports no @argus package", () => {
    const importing = sourceFiles(join(root, "src")).filter((file) =>
      /from\s+["']@argus\//.test(readFileSync(file, "utf8")),
    );
    expect(importing).toEqual([]);
  });

  it("releases only from the deploy branch", () => {
    const config = JSON.parse(
      readFileSync(join(root, ".releaserc.json"), "utf8"),
    ) as {
      branches: string[];
    };
    expect(config.branches).toEqual(["deploy"]);
  });
});
