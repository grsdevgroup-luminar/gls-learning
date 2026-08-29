import { describe, it, expect } from "vitest";
import { UploadStatus } from "@prisma/client";
import { isVideoPlaybackReady } from "../media.service";

describe("isVideoPlaybackReady", () => {
  it("treats lessons without an Upload row as grandfathered ready", () => {
    expect(isVideoPlaybackReady(null)).toBe(true);
  });

  it("allows playback when the upload is READY", () => {
    expect(isVideoPlaybackReady({ status: UploadStatus.READY })).toBe(true);
  });

  it("blocks playback while encoding is in progress", () => {
    expect(isVideoPlaybackReady({ status: UploadStatus.PROCESSING })).toBe(false);
  });

  it("blocks playback for failed uploads", () => {
    expect(isVideoPlaybackReady({ status: UploadStatus.FAILED })).toBe(false);
  });

  it("blocks playback for abandoned uploads", () => {
    expect(isVideoPlaybackReady({ status: UploadStatus.ABANDONED })).toBe(false);
  });

  it("blocks playback for in-flight transport states", () => {
    expect(isVideoPlaybackReady({ status: UploadStatus.UPLOADING })).toBe(false);
    expect(isVideoPlaybackReady({ status: UploadStatus.CREATED })).toBe(false);
  });
});
