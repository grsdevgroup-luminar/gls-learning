import path from "node:path";
import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  PipeTransform,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ALLOWED_RESOURCE_EXTENSIONS,
  ALLOWED_RESOURCE_MIME,
  ALLOWED_RESOURCE_MIME_SET,
} from "../../storage/storage.constants";
import type { Env } from "../../../config/env";

export interface ValidatedResourceFile {
  buffer: Buffer;
  size: number;
  mimeType: string;
  extension: string;
  originalName: string;
}

/** Validates a multer file: size ≤ configured cap, MIME + extension both on
 *  the whitelist. Returning a narrowed shape means callers stop juggling
 *  Express.Multer.File and get a stable contract. */
@Injectable()
export class ResourceFilePipe
  implements PipeTransform<Express.Multer.File | undefined, ValidatedResourceFile>
{
  constructor(private readonly config: ConfigService<Env, true>) {}

  transform(file: Express.Multer.File | undefined): ValidatedResourceFile {
    if (!file) throw new BadRequestException("Missing file");
    const maxBytes =
      this.config.get("STORAGE_MAX_BYTES", { infer: true }) ??
      10 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new PayloadTooLargeException(
        `File exceeds ${Math.floor(maxBytes / (1024 * 1024))} MB limit`,
      );
    }

    const rawExt = path.extname(file.originalname).slice(1).toLowerCase();
    if (!rawExt || !ALLOWED_RESOURCE_EXTENSIONS.includes(rawExt)) {
      throw new UnsupportedMediaTypeException(
        `Unsupported extension. Allowed: ${ALLOWED_RESOURCE_EXTENSIONS.join(", ")}`,
      );
    }

    const mime = file.mimetype.toLowerCase();
    if (!ALLOWED_RESOURCE_MIME_SET.has(mime)) {
      throw new UnsupportedMediaTypeException(
        `Unsupported content type: ${mime}`,
      );
    }
    // MIME must match the extension's declared set — refuses e.g. a .pdf with
    // application/zip, which is the shape of a mis-labelled attack.
    if (!ALLOWED_RESOURCE_MIME[rawExt]!.includes(mime)) {
      throw new UnsupportedMediaTypeException(
        `Extension .${rawExt} does not match content type ${mime}`,
      );
    }

    return {
      buffer: file.buffer,
      size: file.size,
      mimeType: mime,
      extension: rawExt,
      originalName: file.originalname,
    };
  }
}


@Injectable()
export class PptxFilePipe implements PipeTransform<Express.Multer.File | undefined, ValidatedResourceFile> {
  constructor(private readonly config: ConfigService<Env, true>) {}
  transform(file: Express.Multer.File | undefined): ValidatedResourceFile {
    if (!file) throw new BadRequestException("Missing PowerPoint file");
    const maxBytes = this.config.get("STORAGE_MAX_BYTES", { infer: true }) ?? 10 * 1024 * 1024;
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    const mime = file.mimetype.toLowerCase();
    if (file.size > maxBytes || ext !== "pptx" || mime !== "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
      throw new UnsupportedMediaTypeException("Only .pptx PowerPoint files are supported.");
    }
    if (file.buffer.length < 4 || file.buffer[0] !== 0x50 || file.buffer[1] !== 0x4b) {
      throw new UnsupportedMediaTypeException("Only .pptx PowerPoint files are supported.");
    }
    return { buffer: file.buffer, size: file.size, mimeType: mime, extension: ext, originalName: file.originalname };
  }
}
