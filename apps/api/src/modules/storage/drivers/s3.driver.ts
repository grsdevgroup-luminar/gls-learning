import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  PutInput,
  StorageDriver,
  StoredObject,
} from "../storage.driver";
import type { Env } from "../../../config/env";

/**
 * S3-compatible driver — works with AWS S3, Railway's object storage, and R2.
 * `getUrl` returns a signed GET URL when no public base is configured, so the
 * bucket stays private by default and a leaked URL expires within
 * `STORAGE_SIGNED_URL_TTL_SEC` seconds.
 */
@Injectable()
export class S3Driver implements StorageDriver {
  private readonly logger = new Logger(S3Driver.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly ttlSec: number;
  private readonly publicBase: string | null;

  constructor(private readonly config: ConfigService<Env, true>) {
    // Non-null assertions are safe: env.ts superRefine forces these when
    // STORAGE_DRIVER=s3, and the factory only instantiates this class in
    // that case.
    const endpoint = config.get("S3_ENDPOINT", { infer: true })!;
    const region = config.get("S3_REGION", { infer: true });
    const accessKeyId = config.get("S3_ACCESS_KEY_ID", { infer: true })!;
    const secretAccessKey = config.get("S3_SECRET_ACCESS_KEY", { infer: true })!;
    const forcePathStyle =
      config.get("S3_FORCE_PATH_STYLE", { infer: true }) ?? true;

    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle,
      credentials: { accessKeyId, secretAccessKey },
    });
    this.bucket = config.get("S3_BUCKET", { infer: true })!;
    this.ttlSec =
      config.get("STORAGE_SIGNED_URL_TTL_SEC", { infer: true }) ?? 3600;
    const publicBase = config.get("S3_PUBLIC_BASE_URL", { infer: true });
    this.publicBase = publicBase ? publicBase.replace(/\/$/, "") : null;
  }

  async put(input: PutInput): Promise<StoredObject> {
    const safeName = sanitizeFilename(input.originalName);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
        // Serve as an attachment with the author's filename so downloads look
        // sensible even though the S3 key is a ULID.
        ContentDisposition: `attachment; filename="${safeName}"`,
        Metadata: { "original-name": safeName },
      }),
    );

    return {
      key: input.key,
      url: await this.getUrl(input.key),
      bytes: input.contentLength,
      contentType: input.contentType,
    };
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      // Idempotent per driver contract; log for observability.
      this.logger.warn(`S3 delete failed for ${key}: ${(err as Error).message}`);
    }
  }

  async getUrl(key: string): Promise<string> {
    if (this.publicBase) {
      const encoded = key.split("/").map(encodeURIComponent).join("/");
      return `${this.publicBase}/${encoded}`;
    }
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: this.ttlSec },
    );
  }
}

/** ASCII-fold + quote-strip to keep `filename="..."` header parseable. RFC
 *  5987 filename* would be more correct for full unicode, but that requires
 *  every S3 client to opt in; this covers the common instructor case. */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[\r\n"]/g, "")
    .replace(/[^\x20-\x7E]/g, "_")
    .slice(0, 200);
}
