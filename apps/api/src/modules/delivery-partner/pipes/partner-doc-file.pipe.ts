import path from "node:path";
import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  PipeTransform,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import {
  ALLOWED_PARTNER_DOC_EXTENSIONS,
  ALLOWED_PARTNER_DOC_MIME,
  ALLOWED_PARTNER_DOC_MIME_SET,
  PARTNER_DOC_MAX_BYTES,
} from "../../storage/storage.constants";

export interface ValidatedPartnerDocFile {
  buffer: Buffer;
  size: number;
  mimeType: string;
  extension: string;
  originalName: string;
}

/** Validates a delivery-partner application document upload. Mirrors
 *  CvFilePipe/AvatarFilePipe so the reject shape (413 / 415 / 400) is
 *  consistent across upload endpoints. */
@Injectable()
export class PartnerDocFilePipe
  implements PipeTransform<Express.Multer.File | undefined, ValidatedPartnerDocFile>
{
  transform(file: Express.Multer.File | undefined): ValidatedPartnerDocFile {
    if (!file) throw new BadRequestException("Missing file");

    if (file.size > PARTNER_DOC_MAX_BYTES) {
      throw new PayloadTooLargeException(
        `File exceeds ${Math.floor(PARTNER_DOC_MAX_BYTES / (1024 * 1024))} MB limit`,
      );
    }

    const rawExt = path.extname(file.originalname).slice(1).toLowerCase();
    if (!rawExt || !ALLOWED_PARTNER_DOC_EXTENSIONS.includes(rawExt)) {
      throw new UnsupportedMediaTypeException(
        `Unsupported extension. Allowed: ${ALLOWED_PARTNER_DOC_EXTENSIONS.join(", ")}`,
      );
    }

    const mime = file.mimetype.toLowerCase();
    if (!ALLOWED_PARTNER_DOC_MIME_SET.has(mime)) {
      throw new UnsupportedMediaTypeException(
        `Unsupported content type: ${mime}`,
      );
    }
    if (!ALLOWED_PARTNER_DOC_MIME[rawExt]!.includes(mime)) {
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
