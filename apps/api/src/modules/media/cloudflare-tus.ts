import {
  SUPPORTED_VIDEO_EXTENSIONS,
  type TusInitiationMetadata,
} from "@skillstream/shared";

export type { TusInitiationMetadata };

/** tus Upload-Metadata header: `key base64(value)` pairs joined by commas. */
export function encodeTusMetadata(metadata: TusInitiationMetadata): string {
  const pairs: [string, string][] = [
    ["name", metadata.name],
    ["maxDurationSeconds", String(metadata.maxDurationSeconds)],
    ["expiry", metadata.expiry],
  ];
  const encoded = pairs.map(
    ([key, value]) => `${key} ${Buffer.from(value, "utf8").toString("base64")}`,
  );
  if (metadata.requireSignedUrls) encoded.push("requiresignedurls");
  return encoded.join(",");
}

export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 1) return "";
  return filename.slice(dot).toLowerCase();
}

export function isSupportedVideoFilename(filename: string): boolean {
  const ext = fileExtension(filename);
  return (SUPPORTED_VIDEO_EXTENSIONS as readonly string[]).includes(ext);
}

export interface CloudflareTusInitResult {
  uploadUrl: string;
  uid: string;
}

export function parseCloudflareTusInitResponse(
  res: Response,
): CloudflareTusInitResult | null {
  if (res.status !== 201) return null;
  const uploadUrl = res.headers.get("location");
  const uid = res.headers.get("stream-media-id");
  if (!uploadUrl || !uid) return null;
  return { uploadUrl, uid };
}

/** Sanitized provider error for logs / failureReason (no secrets). */
export async function readCloudflareErrorMessage(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as {
      errors?: { code?: number; message?: string }[];
      messages?: string[];
    };
    const fromErrors = json.errors?.map((e) => e.message).filter(Boolean).join("; ");
    if (fromErrors) return fromErrors.slice(0, 500);
    const fromMessages = json.messages?.join("; ");
    if (fromMessages) return fromMessages.slice(0, 500);
  } catch {
    /* fall through */
  }
  return `HTTP ${res.status}`;
}

export class CloudflareTusInitError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly providerMessage: string,
  ) {
    super(`Cloudflare tus init failed (${httpStatus}): ${providerMessage}`);
    this.name = "CloudflareTusInitError";
  }
}

export interface TusUploadProgress {
  offset: number;
  length: number | null;
}

/** HEAD the tus endpoint to verify bytes received (Upload-Offset vs Upload-Length). */
export async function fetchTusUploadProgress(
  uploadUrl: string,
): Promise<TusUploadProgress | null> {
  const res = await fetch(uploadUrl, {
    method: "HEAD",
    headers: { "Tus-Resumable": "1.0.0" },
  });
  if (!res.ok) return null;

  const offsetRaw = res.headers.get("Upload-Offset");
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : Number.NaN;
  if (!Number.isFinite(offset)) return null;

  const lengthRaw = res.headers.get("Upload-Length");
  const length =
    lengthRaw === null || lengthRaw === ""
      ? null
      : Number.parseInt(lengthRaw, 10);

  return {
    offset,
    length: length !== null && Number.isFinite(length) ? length : null,
  };
}

export function tusUploadIsComplete(
  progress: TusUploadProgress,
  expectedBytes: bigint,
): boolean {
  const expected = Number(expectedBytes);
  if (progress.length !== null) {
    return progress.offset === progress.length && progress.offset === expected;
  }
  return progress.offset === expected;
}

export interface CloudflareVideoStatus {
  readyToStream: boolean;
  state: string;
  errorReasonText: string | null;
}

export function parseCloudflareVideoStatus(json: {
  success: boolean;
  result?: {
    readyToStream?: boolean;
    status?: { state?: string; errorReasonText?: string };
  };
}): CloudflareVideoStatus | null {
  if (!json.success || !json.result) return null;
  return {
    readyToStream: !!json.result.readyToStream,
    state: json.result.status?.state ?? "unknown",
    errorReasonText: json.result.status?.errorReasonText ?? null,
  };
}

export function isCloudflareEncodingFailed(state: string): boolean {
  return state === "error" || state === "failed";
}

/** Best-effort DELETE for a Cloudflare Stream video UID. */
export class CloudflareStreamDeleteError extends Error {
  constructor(
    readonly httpStatus: number,
    message: string,
  ) {
    super(`Cloudflare Stream delete failed (${httpStatus}): ${message}`);
    this.name = "CloudflareStreamDeleteError";
  }
}

export async function deleteCloudflareStreamVideo(
  accountId: string,
  token: string,
  uid: string,
): Promise<void> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (res.status === 404 || res.ok) return;

  const message = await readCloudflareErrorMessage(res);
  throw new CloudflareStreamDeleteError(res.status, message);
}
