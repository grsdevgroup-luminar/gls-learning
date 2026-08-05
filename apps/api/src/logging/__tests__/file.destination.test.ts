import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createFileDestination } from "../file.destination";

const createDirectory = () => mkdtemp(join(tmpdir(), "skillstream-logs-"));

describe("createFileDestination", () => {
  it("writes JSON lines to logger-YYYY-MM-DD.log", async () => {
    const directory = await createDirectory();
    const destination = await createFileDestination({
      directory,
      retentionDays: 14,
      now: () => new Date("2026-08-05T12:00:00.000Z"),
    });

    destination.stream.write('{"msg":"hello"}\n');
    await destination.close();

    expect(
      await readFile(join(directory, "logger-2026-08-05.log"), "utf8"),
    ).toBe('{"msg":"hello"}\n');
  });

  it("rotates on the next UTC date before writing the next record", async () => {
    const directory = await createDirectory();
    let now = new Date("2026-08-05T23:59:59.000Z");
    const destination = await createFileDestination({
      directory,
      retentionDays: 14,
      now: () => now,
    });

    destination.stream.write('{"day":5}\n');
    now = new Date("2026-08-06T00:00:01.000Z");
    destination.stream.write('{"day":6}\n');
    await destination.close();

    expect(await readdir(directory)).toEqual([
      "logger-2026-08-05.log",
      "logger-2026-08-06.log",
    ]);
  });

  it("removes expired dated logs while preserving retained and unrelated entries", async () => {
    const directory = await createDirectory();
    await Promise.all([
      writeFile(join(directory, "logger-2026-07-22.log"), "expired\n"),
      writeFile(join(directory, "logger-2026-07-23.log"), "retained\n"),
      writeFile(join(directory, "notes.log"), "notes\n"),
      writeFile(join(directory, "logger-not-a-date.log"), "malformed\n"),
      mkdir(join(directory, "logger-2026-07-01.log")),
    ]);

    const destination = await createFileDestination({
      directory,
      retentionDays: 14,
      now: () => new Date("2026-08-05T12:00:00.000Z"),
    });
    await destination.close();

    await expect(
      stat(join(directory, "logger-2026-07-22.log")),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(
      stat(join(directory, "logger-2026-07-23.log")),
    ).resolves.toBeDefined();
    await expect(stat(join(directory, "notes.log"))).resolves.toBeDefined();
    await expect(
      stat(join(directory, "logger-not-a-date.log")),
    ).resolves.toBeDefined();
    expect(
      (await stat(join(directory, "logger-2026-07-01.log"))).isDirectory(),
    ).toBe(true);
  });

  it("applies retention again when UTC rotation opens the next file", async () => {
    const directory = await createDirectory();
    await Promise.all([
      writeFile(join(directory, "logger-2026-07-23.log"), "retained\n"),
      writeFile(join(directory, "notes.log"), "notes\n"),
      writeFile(join(directory, "logger-not-a-date.log"), "malformed\n"),
    ]);
    let now = new Date("2026-08-05T23:59:59.000Z");
    const destination = await createFileDestination({
      directory,
      retentionDays: 14,
      now: () => now,
    });

    await expect(
      stat(join(directory, "logger-2026-07-23.log")),
    ).resolves.toBeDefined();
    now = new Date("2026-08-06T00:00:01.000Z");
    destination.stream.write('{"day":6}\n');
    await destination.close();

    await expect(
      stat(join(directory, "logger-2026-07-23.log")),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(stat(join(directory, "notes.log"))).resolves.toBeDefined();
    await expect(
      stat(join(directory, "logger-not-a-date.log")),
    ).resolves.toBeDefined();
  });

  it("rejects an unusable destination path during initialization", async () => {
    const directory = await createDirectory();
    const filePath = join(directory, "not-a-directory");
    await writeFile(filePath, "file\n");

    await expect(
      createFileDestination({
        directory: filePath,
        retentionDays: 14,
        now: () => new Date("2026-08-05T12:00:00.000Z"),
      }),
    ).rejects.toBeDefined();
  });
});
