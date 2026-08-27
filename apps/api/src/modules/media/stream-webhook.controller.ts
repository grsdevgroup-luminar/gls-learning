import {
  Controller,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { Public } from "../../common/decorators/decorators";
import { MediaService } from "./media.service";

@ApiTags("media")
@Controller()
export class StreamWebhookController {
  constructor(private readonly media: MediaService) {}

  @Public()
  @Post("webhooks/cloudflare-stream")
  @HttpCode(200)
  async cloudflareStream(
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    await this.media.handleStreamWebhook(
      req.rawBody as Buffer,
      req.headers["webhook-signature"] as string | undefined,
    );
    return { received: true };
  }
}
