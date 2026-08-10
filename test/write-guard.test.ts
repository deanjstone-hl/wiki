import { describe, expect, test } from "vitest";
import { evaluateWritePath } from "../src/agent/claude-cli/write-guard.ts";

describe("evaluateWritePath", () => {
  const repoRoot = "/home/deanj/repos/argus-wiki";

  test("allows writes inside the allowed directory", () => {
    const decision = evaluateWritePath({
      repoRoot,
      allowedRelativeDir: "arguswiki",
      filePath: "/home/deanj/repos/argus-wiki/arguswiki/architecture.md",
    });
    expect(decision).toEqual({ allowed: true });
  });

  test("allows writes at the allowed directory root itself", () => {
    const decision = evaluateWritePath({
      repoRoot,
      allowedRelativeDir: "arguswiki",
      filePath: "/home/deanj/repos/argus-wiki/arguswiki",
    });
    expect(decision.allowed).toBe(true);
  });

  test("refuses writes elsewhere in the repo", () => {
    const decision = evaluateWritePath({
      repoRoot,
      allowedRelativeDir: "arguswiki",
      filePath: "/home/deanj/repos/argus-wiki/AGENTS.md",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("Refused path: /home/deanj");
  });

  test("refuses a sibling directory that merely shares a prefix", () => {
    const decision = evaluateWritePath({
      repoRoot,
      allowedRelativeDir: "arguswiki",
      filePath: "/home/deanj/repos/argus-wiki/arguswiki-fake/notes.md",
    });
    expect(decision.allowed).toBe(false);
  });

  test("refuses writes outside the repository entirely", () => {
    const decision = evaluateWritePath({
      repoRoot,
      allowedRelativeDir: "arguswiki",
      filePath: "/etc/passwd",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("outside the repository");
  });

  test("refuses path traversal back out of the allowed directory", () => {
    const decision = evaluateWritePath({
      repoRoot,
      allowedRelativeDir: "arguswiki",
      filePath: "/home/deanj/repos/argus-wiki/arguswiki/../../../etc/passwd",
    });
    expect(decision.allowed).toBe(false);
  });

  test("resolves relative file paths against the hook's reported cwd", () => {
    const decision = evaluateWritePath({
      repoRoot,
      allowedRelativeDir: "arguswiki",
      filePath: "architecture.md",
      cwd: "/home/deanj/repos/argus-wiki/arguswiki",
    });
    expect(decision.allowed).toBe(true);
  });

  test("refuses an empty file path", () => {
    const decision = evaluateWritePath({
      repoRoot,
      allowedRelativeDir: "arguswiki",
      filePath: "",
    });
    expect(decision.allowed).toBe(false);
  });
});
