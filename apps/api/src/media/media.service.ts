import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { DirectUploadDto, PlaybackDto } from "@skillstream/shared";
import { PrismaService } from "../prisma/prisma.service";
import { EnrollmentService } from "../enrollment/enrollment.service";
import type { Env } from "../config/env";

@Injectable()
export class MediaService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    private readonly enrollment: EnrollmentService,
  ) {}

  private cf() {
    const accountId = this.config.get("CLOUDFLARE_ACCOUNT_ID", { infer: true });
    const token = this.config.get("CLOUDFLARE_STREAM_TOKEN", { infer: true });
    if (!accountId || !token)
      throw new ServiceUnavailableException("Cloudflare Stream not configured");
    return { accountId, token };
  }

  /** Creates a one-time direct-creator-upload URL for an instructor. */
  async createDirectUpload(): Promise<DirectUploadDto> {
    const { accountId, token } = this.cf();
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ maxDurationSeconds: 7200, requireSignedURLs: true }),
      },
    );
    const json = (await res.json()) as {
      success: boolean;
      result?: { uploadURL: string; uid: string };
    };
    if (!json.success || !json.result)
      throw new ServiceUnavailableException("Failed to create upload URL");
    return { uploadUrl: json.result.uploadURL, uid: json.result.uid };
  }

  /** Returns signed playback for an enrolled (or preview) lesson. */
  async getPlayback(userId: string, lessonId: string): Promise<PlaybackDto> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        type: true,
        preview: true,
        articleContent: true,
        cfVideoUid: true,
        section: { select: { courseId: true } },
      },
    });
    if (!lesson) throw new NotFoundException("Lesson not found");

    if (!lesson.preview) {
      const enrolled = await this.enrollment.isEnrolled(
        userId,
        lesson.section.courseId,
      );
      if (!enrolled) throw new ForbiddenException("Enroll to access this lesson");
    }

    if (lesson.type === "ARTICLE") {
      return {
        lessonId,
        type: lesson.type,
        ready: true,
        hlsUrl: null,
        iframeUrl: null,
        articleContent: lesson.articleContent,
      };
    }

    if (lesson.type !== "VIDEO" || !lesson.cfVideoUid) {
      return {
        lessonId,
        type: lesson.type,
        ready: false,
        hlsUrl: null,
        iframeUrl: null,
        articleContent: null,
      };
    }

    const token = await this.signStreamToken(lesson.cfVideoUid);
    return {
      lessonId,
      type: lesson.type,
      ready: true,
      hlsUrl: `https://videodelivery.net/${token}/manifest/video.m3u8`,
      iframeUrl: `https://iframe.videodelivery.net/${token}`,
      articleContent: null,
    };
  }

  /** Requests a short-lived signed token for a Stream video UID. */
  private async signStreamToken(uid: string): Promise<string> {
    const { accountId, token } = this.cf();
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
      },
    );
    const json = (await res.json()) as {
      success: boolean;
      result?: { token: string };
    };
    if (!json.success || !json.result)
      throw new ServiceUnavailableException("Failed to sign playback token");
    return json.result.token;
  }
}
