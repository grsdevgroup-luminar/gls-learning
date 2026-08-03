import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import type { Request, Response } from "express";

export interface SuccessResponse<T> {
  success: true;
  statusCode: number;
  data: T;
  path: string;
  timestamp: string;
}

/**
 * Wraps controller return values in a consistent success envelope.
 * Skips binary payloads (StreamableFile, Buffer) so file downloads stay raw.
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, SuccessResponse<T> | T>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessResponse<T> | T> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    return next.handle().pipe(
      map((payload) => {
        if (payload instanceof StreamableFile || Buffer.isBuffer(payload)) {
          return payload;
        }
        return {
          success: true,
          statusCode: res.statusCode,
          data: payload,
          path: req.originalUrl,
          timestamp: new Date().toISOString(),
        } satisfies SuccessResponse<T>;
      }),
    );
  }
}
