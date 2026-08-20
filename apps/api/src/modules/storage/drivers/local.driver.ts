import { promises as fs } from "node:fs";
import path from "node:path";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  PutInput,
  StorageDriver,
  StoredObject,
} from "../storage.driver";
import type { Env } from "../../../config/env";

/**
 * Writes objects under `STORAGE_LOCAL_DIR` on the API host. `getUrl` returns a
 * `${PUBLIC_API_URL}/uploads/{key}` URL served by ServeStaticModule (see
 * app.module.ts). Only used in dev/test — production must run the S3 driver.
 */
@Injectable()
export class LocalDriver implements StorageDriver {
  private readonly logger = new Logger(LocalDriver.name);
  private readonly root: string;
  private readonly publicBase: string;

  constructor(config: ConfigService<Env, true>) {
    const dir = config.get("STORAGE_LOCAL_DIR", { infer: true }) ?? "uploads";
    // Resolve relative to the API process cwd so `pnpm dev` and `node dist`
    // put files in the same place.
    this.root = path.resolve(process.cwd(), dir);
    const apiBase =
      config.get("PUBLIC_API_URL", { infer: true }) ??
      `http://localhost:${config.get("PORT", { infer: true }) ?? 4000}`;
    this.publicBase = apiBase.replace(/\/$/, "");
  }

  async put(input: PutInput): Promise<StoredObject> {
    // Path-traversal defense: after resolving the target must still live
    // inside `root`. Keys are ULID-based today so this is belt-and-braces,
    // but if `key` ever gets client influence we already refuse "..".
    const target = path.resolve(this.root, input.key);
    if (!target.startsWith(`${this.root}${path.sep}`) && target !== this.root) {
      throw new Error(`Refusing to write outside storage root: ${input.key}`);
    }

    await fs.mkdir(path.dirname(target), { recursive: true });
    const body = Buffer.isBuffer(input.body)
      ? input.body
      : await streamToBuffer(input.body);
    await fs.writeFile(target, body);

    return {
      key: input.key,
      url: await this.getUrl(input.key),
      bytes: body.byteLength,
      contentType: input.contentType,
    };
  }

  async delete(key: string): Promise<void> {
    const target = path.resolve(this.root, key);
    if (!target.startsWith(`${this.root}${path.sep}`)) return;
    try {
      await fs.unlink(target);
    } catch (err) {
      // Idempotent: missing file is fine, anything else is worth logging.
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        this.logger.warn(`Local delete failed for ${key}: ${(err as Error).message}`);
      }
    }
  }

  async getUrl(key: string): Promise<string> {
    // Encode each segment individually so ULIDs and extensions survive but
    // any accidental slashes/spaces get escaped.
    const encoded = key.split("/").map(encodeURIComponent).join("/");
    return `${this.publicBase}/uploads/${encoded}`;
  }
}

async function streamToBuffer(
  stream: NodeJS.ReadableStream,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
