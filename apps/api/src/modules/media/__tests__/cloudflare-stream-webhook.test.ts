import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import {
  parseCloudflareStreamWebhookPayload,
  parseCloudflareStreamWebhookSignature,
  resolveStreamWebhookEncodingOutcome,
  streamWebhookFailureReason,
  verifyCloudflareStreamWebhookSignature,
} from "../cloudflare-stream-webhook";

const secret = "85011ed3a913c6ad5f9cf6c5573cc0a7";
const fixedNow = 1_230_811_200_000;

function sign(body: string, time = "1230811200") {
  const raw = Buffer.from(body, "utf8");
  const source = Buffer.concat([Buffer.from(`${time}.`, "utf8"), raw]);
  const sig1 = createHmac("sha256", secret).update(source).digest("hex");
  return { raw, header: `time=${time},sig1=${sig1}` };
}

describe("parseCloudflareStreamWebhookSignature", () => {
  it("parses time and sig1 from the header", () => {
    expect(
      parseCloudflareStreamWebhookSignature(
        "time=1230811200,sig1=60493ec9388b44585a29543bcf0de62e377d4da393246a8b1c901d0e3e672404",
      ),
    ).toEqual({
      time: "1230811200",
      sig1: "60493ec9388b44585a29543bcf0de62e377d4da393246a8b1c901d0e3e672404",
    });
  });

  it("returns null for malformed headers", () => {
    expect(parseCloudflareStreamWebhookSignature("time=123")).toBeNull();
    expect(parseCloudflareStreamWebhookSignature("")).toBeNull();
  });
});

describe("verifyCloudflareStreamWebhookSignature", () => {
  it("accepts a valid signature within the replay window", () => {
    const body = JSON.stringify({ uid: "vid_1", readyToStream: true, status: { state: "ready" } });
    const { raw, header } = sign(body);
    expect(
      verifyCloudflareStreamWebhookSignature(raw, header, secret, fixedNow),
    ).toBe(true);
  });

  it("rejects tampered bodies", () => {
    const body = JSON.stringify({ uid: "vid_1", readyToStream: true, status: { state: "ready" } });
    const { header } = sign(body);
    const tampered = Buffer.from(body.replace("vid_1", "vid_2"), "utf8");
    expect(
      verifyCloudflareStreamWebhookSignature(tampered, header, secret, fixedNow),
    ).toBe(false);
  });

  it("rejects stale timestamps", () => {
    const body = JSON.stringify({ uid: "vid_1", readyToStream: true, status: { state: "ready" } });
    const { raw, header } = sign(body, "1000000000");
    expect(
      verifyCloudflareStreamWebhookSignature(raw, header, secret, fixedNow),
    ).toBe(false);
  });
});

describe("parseCloudflareStreamWebhookPayload", () => {
  it("parses Cloudflare's webhook video shape", () => {
    expect(
      parseCloudflareStreamWebhookPayload({
        uid: "cf_vid_1",
        readyToStream: true,
        status: { state: "ready", pctComplete: "100" },
      }),
    ).toMatchObject({
      uid: "cf_vid_1",
      readyToStream: true,
      status: { state: "ready" },
    });
  });

  it("accepts webhook error field names", () => {
    const video = parseCloudflareStreamWebhookPayload({
      uid: "cf_vid_1",
      readyToStream: false,
      status: {
        state: "error",
        errReasonCode: "ERR_MALFORMED_VIDEO",
        errReasonText: "Corrupt file",
      },
    });
    expect(streamWebhookFailureReason(video)).toBe("Corrupt file");
  });
});

describe("resolveStreamWebhookEncodingOutcome", () => {
  it("maps ready payloads to READY", () => {
    expect(
      resolveStreamWebhookEncodingOutcome({
        uid: "x",
        readyToStream: true,
        status: { state: "ready" },
      }),
    ).toBe("ready");
  });

  it("maps error payloads to FAILED", () => {
    expect(
      resolveStreamWebhookEncodingOutcome({
        uid: "x",
        readyToStream: false,
        status: { state: "error", errReasonText: "bad" },
      }),
    ).toBe("failed");
  });

  it("ignores in-progress payloads", () => {
    expect(
      resolveStreamWebhookEncodingOutcome({
        uid: "x",
        readyToStream: false,
        status: { state: "inprogress" },
      }),
    ).toBeNull();
  });
});
