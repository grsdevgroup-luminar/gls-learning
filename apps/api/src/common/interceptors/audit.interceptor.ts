import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import type { RequestUser } from "../decorators/decorators";

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);
// Noisy/irrelevant paths we don't audit.
const SKIP = [/\/auth\//, /\/webhooks\//];

/** Records authenticated mutations to the AuditLog table (fire-and-forget). */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as RequestUser | undefined;
    const shouldAudit =
      MUTATING.has(req.method) &&
      user &&
      !SKIP.some((re) => re.test(req.path));

    return next.handle().pipe(
      tap(() => {
        if (!shouldAudit) return;
        void this.prisma.auditLog
          .create({
            data: {
              actorUserId: user.id,
              action: req.method,
              entity: req.route?.path ?? req.path,
              entityId: (req.params as Record<string, string>)?.id ?? null,
              metadata: {
                path: req.originalUrl,
                params: req.params,
              } as object,
            },
          })
          .catch(() => undefined);
      }),
    );
  }
}
