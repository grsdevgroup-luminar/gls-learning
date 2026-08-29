import path from "node:path";
import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  PipeTransform,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import {
  ALLOWED_AVATAR_EXTENSIONS,
  ALLOWED_AVATAR_MIME,
  ALLOWED_AVATAR_MIME_SET,
  AVATAR_MAX_BYTES,
} from "../../storage/storage.constants";

export interface ValidatedAvatarFile {
  buffer: Buffer;
  size: number;
  mimeType: string;
  extension: string;
  originalName: string;
}

/** Validates an avatar upload: image-only whitelist, MIME/extension agreement,
 *  and a smaller cap than lesson resources. Mirrors ResourceFilePipe so the
 *  reject shape (413 / 415 / 400) is consistent across upload endpoints. */
@Injectable()
export class AvatarFilePipe
  implements PipeTransform<Express.Multer.File | undefined, ValidatedAvatarFile>
{
  transform(file: Express.Multer.File | undefined): ValidatedAvatarFile {
    if (!file) throw new BadRequestException("Missing file");

    if (file.size > AVATAR_MAX_BYTES) {
      throw new PayloadTooLargeException(
        `Avatar exceeds ${Math.floor(AVATAR_MAX_BYTES / (1024 * 1024))} MB limit`,
      );
    }

    const rawExt = path.extname(file.originalname).slice(1).toLowerCase();
    if (!rawExt || !ALLOWED_AVATAR_EXTENSIONS.includes(rawExt)) {
      throw new UnsupportedMediaTypeException(
        `Unsupported extension. Allowed: ${ALLOWED_AVATAR_EXTENSIONS.join(", ")}`,
      );
    }

    const mime = file.mimetype.toLowerCase();
    if (!ALLOWED_AVATAR_MIME_SET.has(mime)) {
      throw new UnsupportedMediaTypeException(
        `Unsupported content type: ${mime}`,
      );
    }
    // MIME must agree with the declared extension — refuses e.g. a .png with
    // image/gif, which is the shape of a mis-labelled upload.
    if (!ALLOWED_AVATAR_MIME[rawExt]!.includes(mime)) {
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
