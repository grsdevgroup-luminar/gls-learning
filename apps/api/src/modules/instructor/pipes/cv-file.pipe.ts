import path from "node:path";
import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  PipeTransform,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import {
  ALLOWED_CV_EXTENSIONS,
  ALLOWED_CV_MIME,
  ALLOWED_CV_MIME_SET,
  CV_MAX_BYTES,
} from "../../storage/storage.constants";

export interface ValidatedCvFile {
  buffer: Buffer;
  size: number;
  mimeType: string;
  extension: string;
  originalName: string;
}

/** Validates a CV upload: document-only whitelist (pdf/doc/docx), MIME/
 *  extension agreement. Mirrors AvatarFilePipe/ResourceFilePipe so the reject
 *  shape (413 / 415 / 400) is consistent across upload endpoints. The file
 *  itself is optional at the form level — this pipe only runs when a file is
 *  actually attached to the request. */
@Injectable()
export class CvFilePipe
  implements PipeTransform<Express.Multer.File | undefined, ValidatedCvFile>
{
  transform(file: Express.Multer.File | undefined): ValidatedCvFile {
    if (!file) throw new BadRequestException("Missing file");

    if (file.size > CV_MAX_BYTES) {
      throw new PayloadTooLargeException(
        `CV exceeds ${Math.floor(CV_MAX_BYTES / (1024 * 1024))} MB limit`,
      );
    }

    const rawExt = path.extname(file.originalname).slice(1).toLowerCase();
    if (!rawExt || !ALLOWED_CV_EXTENSIONS.includes(rawExt)) {
      throw new UnsupportedMediaTypeException(
        `Unsupported extension. Allowed: ${ALLOWED_CV_EXTENSIONS.join(", ")}`,
      );
    }

    const mime = file.mimetype.toLowerCase();
    if (!ALLOWED_CV_MIME_SET.has(mime)) {
      throw new UnsupportedMediaTypeException(
        `Unsupported content type: ${mime}`,
      );
    }
    if (!ALLOWED_CV_MIME[rawExt]!.includes(mime)) {
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
