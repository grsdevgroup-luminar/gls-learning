import { describe, it, expect } from "vitest";
import {
  encodeTusMetadata,
  fileExtension,
  fetchTusUploadProgress,
  isSupportedVideoFilename,
  parseCloudflareTusInitResponse,
  parseCloudflareVideoStatus,
  tusUploadIsComplete,
} from "../cloudflare-tus";

describe("encodeTusMetadata", () => {
  it("encodes expiry as RFC3339, not unix seconds", () => {
    const expiry = "2026-08-28T03:00:00.000Z";
    const header = encodeTusMetadata({
      name: "lesson.mp4",
      maxDurationSeconds: 7200,
      requireSignedUrls: true,
      expiry,
    });
    const expiryB64 = Buffer.from(expiry, "utf8").toString("base64");
    expect(header).toContain(`expiry ${expiryB64}`);
    expect(header).not.toContain(
      Buffer.from(String(Math.floor(Date.parse(expiry) / 1000)), "utf8").toString("base64"),
    );
    expect(header).toContain("requiresignedurls");
  });
});

describe("tusUploadIsComplete", () => {
  it("requires offset to match both Upload-Length and expected bytes", () => {
    expect(
      tusUploadIsComplete({ offset: 1_048_576, length: 1_048_576 }, 1_048_576n),
    ).toBe(true);
    expect(
      tusUploadIsComplete({ offset: 500_000, length: 1_048_576 }, 1_048_576n),
    ).toBe(false);
  });

  it("falls back to expected bytes when Upload-Length is absent", () => {
    expect(tusUploadIsComplete({ offset: 1024, length: null }, 1024n)).toBe(true);
    expect(tusUploadIsComplete({ offset: 512, length: null }, 1024n)).toBe(false);
  });
});

describe("parseCloudflareVideoStatus", () => {
  it("extracts encoding state and errors", () => {
    expect(
      parseCloudflareVideoStatus({
        success: true,
        result: {
          readyToStream: false,
          status: { state: "inprogress", errorReasonText: "" },
        },
      }),
    ).toMatchObject({ state: "inprogress", readyToStream: false });
  });
});

describe("isSupportedVideoFilename", () => {
  it("accepts common video extensions", () => {
    expect(isSupportedVideoFilename("intro.MP4")).toBe(true);
    expect(isSupportedVideoFilename("clip.mov")).toBe(true);
    expect(isSupportedVideoFilename("demo.webm")).toBe(true);
  });

  it("rejects non-video extensions", () => {
    expect(isSupportedVideoFilename("notes.pdf")).toBe(false);
    expect(isSupportedVideoFilename("noext")).toBe(false);
  });
});

describe("fileExtension", () => {
  it("returns lowercase extension including dot", () => {
    expect(fileExtension("My.Video.MOV")).toBe(".mov");
  });
});

describe("parseCloudflareTusInitResponse", () => {
  it("parses 201 responses with Location and stream-media-id", () => {
    const res = new Response(null, {
      status: 201,
      headers: {
        Location: "https://upload.cloudflarestream.com/tus/abc",
        "stream-media-id": "cf_uid_123",
      },
    });
    expect(parseCloudflareTusInitResponse(res)).toEqual({
      uploadUrl: "https://upload.cloudflarestream.com/tus/abc",
      uid: "cf_uid_123",
    });
  });

  it("returns null when headers are missing", () => {
    const res = new Response(null, { status: 201, headers: {} });
    expect(parseCloudflareTusInitResponse(res)).toBeNull();
  });
});

describe("fetchTusUploadProgress", () => {
  it("parses Upload-Offset and Upload-Length from HEAD", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(null, {
        status: 200,
        headers: {
          "Upload-Offset": "1048576",
          "Upload-Length": "1048576",
        },
      });

    await expect(
      fetchTusUploadProgress("https://upload.example/tus/x"),
    ).resolves.toEqual({ offset: 1_048_576, length: 1_048_576 });

    globalThis.fetch = originalFetch;
  });
});
