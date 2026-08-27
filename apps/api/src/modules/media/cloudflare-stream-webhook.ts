import { createHmac, timingSafeEqual } from "node:crypto";
import { isCloudflareEncodingFailed } from "./cloudflare-tus";

/** Default replay window for Cloudflare Stream webhook timestamps. */
export const STREAM_WEBHOOK_MAX_AGE_MS = 5 * 60 * 1000;

export interface CloudflareStreamWebhookVideo {
  uid: string;
  readyToStream: boolean;
  status: {
    state: string;
    errorReasonText?: string | null;
    errorReasonCode?: string | null;
    errReasonText?: string | null;
    errReasonCode?: string | null;
  };
}

export function parseCloudflareStreamWebhookSignature(
  header: string,
): { time: string; sig1: string } | null {
  const parts = Object.fromEntries(
    header.split(",").map((segment) => {
      const eq = segment.indexOf("=");
      if (eq < 0) return [segment.trim(), ""];
      return [segment.slice(0, eq).trim(), segment.slice(eq + 1).trim()];
    }),
  );
  const time = parts.time;
  const sig1 = parts.sig1;
  if (!time || !sig1) return null;
  return { time, sig1 };
}

export function verifyCloudflareStreamWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
  nowMs: number = Date.now(),
  maxAgeMs: number = STREAM_WEBHOOK_MAX_AGE_MS,
): boolean {
  if (!signatureHeader) return false;

  const parsed = parseCloudflareStreamWebhookSignature(signatureHeader);
  if (!parsed) return false;

  const timestamp = Number.parseInt(parsed.time, 10);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(nowMs - timestamp * 1000) > maxAgeMs) return false;

  const source = Buffer.concat([
    Buffer.from(`${parsed.time}.`, "utf8"),
    rawBody,
  ]);
  const expected = createHmac("sha256", secret).update(source).digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(parsed.sig1, "utf8");
  if (expectedBuf.length !== receivedBuf.length) {
    timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }
  return timingSafeEqual(expectedBuf, receivedBuf);
}

export function parseCloudflareStreamWebhookPayload(
  body: unknown,
): CloudflareStreamWebhookVideo {
  if (!body || typeof body !== "object") {
    throw new Error("Webhook payload must be an object");
  }
  const record = body as Record<string, unknown>;
  const uid = record.uid;
  if (typeof uid !== "string" || !uid) {
    throw new Error("Webhook payload missing uid");
  }

  const statusRaw = record.status;
  if (!statusRaw || typeof statusRaw !== "object") {
    throw new Error("Webhook payload missing status");
  }
  const status = statusRaw as Record<string, unknown>;
  const state = status.state;
  if (typeof state !== "string" || !state) {
    throw new Error("Webhook payload missing status.state");
  }

  return {
    uid,
    readyToStream: record.readyToStream === true,
    status: {
      state,
      errorReasonText:
        typeof status.errorReasonText === "string" ? status.errorReasonText : null,
      errorReasonCode:
        typeof status.errorReasonCode === "string" ? status.errorReasonCode : null,
      errReasonText:
        typeof status.errReasonText === "string" ? status.errReasonText : null,
      errReasonCode:
        typeof status.errReasonCode === "string" ? status.errReasonCode : null,
    },
  };
}

export function streamWebhookFailureReason(
  video: CloudflareStreamWebhookVideo,
): string {
  const { status } = video;
  return (
    status.errorReasonText ??
    status.errReasonText ??
    status.errorReasonCode ??
    status.errReasonCode ??
    "Cloudflare reported an encoding error"
  );
}

/** Maps a verified webhook video payload to a terminal upload status, if any. */
export function resolveStreamWebhookEncodingOutcome(
  video: CloudflareStreamWebhookVideo,
): "ready" | "failed" | null {
  if (video.readyToStream || video.status.state === "ready") return "ready";
  if (isCloudflareEncodingFailed(video.status.state)) return "failed";
  return null;
}
