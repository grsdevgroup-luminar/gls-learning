import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { Db } from "../types";

export interface AuditRecordInput {
  actorUserId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  /** The user this action happened *to*, when different from the actor
   *  (e.g. a student removed from an org/partner) — the generic
   *  AuditInterceptor can't populate this, only explicit calls here can. */
  affectedUserId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Purpose-built audit writes for actions the generic AuditInterceptor can't
 *  capture well: body fields (e.g. a removal `reason`) and a clean
 *  "who this happened to" field. Fire-and-forget, same as
 *  NotificationsService.notify — an audit write must never fail the action
 *  it's recording. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditRecordInput, tx?: Db): Promise<void> {
    const db = tx ?? this.prisma;
    try {
      await db.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId ?? null,
          affectedUserId: input.affectedUserId ?? null,
          metadata: (input.metadata ?? {}) as object,
        },
      });
    } catch {
      // never let an audit write fail the action it's recording
    }
  }
}
