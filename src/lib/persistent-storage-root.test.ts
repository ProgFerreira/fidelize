import { describe, expect, it, vi, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { persistentStorageRoot } from "./persistent-storage-root";

describe("persistentStorageRoot", () => {
  const dirs: string[] = [];
  const cwdSpy = vi.spyOn(process, "cwd");

  afterEach(() => {
    cwdSpy.mockReset();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it("sobe os diretórios até achar hostinger.env", () => {
    const root = mkdtempSync(join(tmpdir(), "fidelize-storage-"));
    dirs.push(root);
    writeFileSync(join(root, "hostinger.env"), "SETUP_SECRET=x\n");

    const nested = join(root, "hbuilds", "versions", "abc123", "nodejs");
    mkdirSync(nested, { recursive: true });

    cwdSpy.mockReturnValue(nested);

    expect(persistentStorageRoot()).toBe(root);
  });

  it("cai de volta em process.cwd() quando não acha hostinger.env/fidelize.env", () => {
    const isolated = mkdtempSync(join(tmpdir(), "fidelize-storage-none-"));
    dirs.push(isolated);

    cwdSpy.mockReturnValue(isolated);

    expect(persistentStorageRoot()).toBe(isolated);
  });
});
