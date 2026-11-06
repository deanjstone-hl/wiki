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

describe("the Release workflow tests the promoted commit before it releases", () => {
  const workflow = readFileSync(
    join(root, ".github/workflows/release.yml"),
    "utf8",
  )
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");

  it("runs on a push to deploy and never on workflow_run", () => {
    expect(workflow).toMatch(/push:\s*\n\s*branches:\s*\[deploy\]/);
    expect(workflow).not.toMatch(/workflow_run/);
  });

  it("names the test job after what it runs", () => {
    expect(workflow).toMatch(
      /name:\s*Test before release \(typecheck, lint, build, unit tests\)/,
    );
  });

  it("tests github.sha with the same gate as the pull request CI", () => {
    expect(workflow).toMatch(/ref:\s*\$\{\{\s*github\.sha\s*\}\}/);
    expect(workflow).toMatch(/run:\s*scripts\/ci\.sh/);
  });

  it("makes the Release job wait for the test job", () => {
    expect(workflow).toMatch(/needs:\s*test/);
    expect(workflow).toMatch(/name:\s*Release\s*\n/);
  });

  it("serialises releases without cancelling a running one", () => {
    expect(workflow).toMatch(/group:\s*release\s*\n/);
    expect(workflow).toMatch(/cancel-in-progress:\s*false/);
  });

  it("refuses a manual dispatch from any ref but deploy", () => {
    expect(workflow).toMatch(/refs\/heads\/deploy/);
  });
});
