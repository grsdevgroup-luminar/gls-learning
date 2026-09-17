import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DeliveryPartnerApplication, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { ulid } from "ulid";
import {
  parsePartnerCustomFields,
  parsePartnerDocuments,
} from "@skillstream/shared";
import type {
  AdminDeliveryPartnerApplicationQuery,
  AdminDeliveryPartnerQuery,
  ApplyDeliveryPartnerInput,
  DeliveryPartnerApplicationDto,
  DeliveryPartnerApplicationStatsDto,
  DeliveryPartnerDto,
  DeliveryPartnerReferralDto,
  DeliveryPartnerSignupInput,
  Paginated,
  PartnerDocumentDto,
  ReviewPartnerApplicationInput,
  UpdatePartnerInput,
} from "@skillstream/shared";
import type { RequestUser } from "../../common/decorators/decorators";
import { NotificationsService } from "../notifications/notifications.service";
import {
  PARTNER_DOC_KEY_PREFIX,
  PARTNER_DOC_MAX_COUNT,
  STORAGE_DRIVER,
} from "../storage/storage.constants";
import type { StorageDriver } from "../storage/storage.driver";
import {
  DeliveryPartnerRepository,
  type DeliveryPartnerRow,
} from "./delivery-partner.repository";
import type { ValidatedPartnerDocFile } from "./pipes/partner-doc-file.pipe";

@Injectable()
export class DeliveryPartnerService {
  constructor(
    private readonly repo: DeliveryPartnerRepository,
    private readonly notifications: NotificationsService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  private toDto(a: DeliveryPartnerRow): DeliveryPartnerDto {
    return {
      id: a.id,
      userId: a.userId,
      name: a.user.name,
      email: a.user.email,
      region: a.region,
      referralCode: a.referralCode,
      commissionPercent: a.commissionPercent,
      status: a.status,
      totalEarningsCents: a.totalEarningsCents,
      pendingEarningsCents: a.pendingEarningsCents,
      paidEarningsCents: a.paidEarningsCents,
      referralCount: a.referralCount,
      createdAt: a.createdAt.toISOString(),
    };
  }

  /** Re-resolves every document's URL through the storage driver on every
   *  read — the key is what's durable; a signed S3 URL minted at upload time
   *  may have expired by the time an admin opens the application. */
  private async toAppDto(
    a: DeliveryPartnerApplication,
  ): Promise<DeliveryPartnerApplicationDto> {
    const documents = parsePartnerDocuments(a.documents);
    const resolved: PartnerDocumentDto[] = await Promise.all(
      documents.map(async (d) => ({
        ...d,
        url: await this.storage.getUrl(d.key).catch(() => ""),
      })),
    );
    return {
      id: a.id,
      name: a.name,
      email: a.email,
      country: a.country,
      customFields: parsePartnerCustomFields(a.customFields),
      documents: resolved,
      status: a.status,
      appliedAt: a.appliedAt.toISOString(),
      reviewedAt: a.reviewedAt?.toISOString() ?? null,
      note: a.note,
    };
  }

  // ── application ──────────────────────────────────────────────────────────
  async apply(
    user: RequestUser,
    input: ApplyDeliveryPartnerInput,
  ): Promise<DeliveryPartnerApplicationDto> {
    const dbUser = await this.repo.findUserByIdOrThrow(user.id);
    const pending = await this.repo.findPendingApplicationByUser(user.id);
    if (pending) throw new BadRequestException("You already have a pending application");

    const app = await this.createApplicationRecord(
      user.id,
      dbUser.name,
      dbUser.email,
      input,
    );
    return this.toAppDto(app);
  }

  /** Shared by `apply()` (an existing account applying) and
   *  `createSignupApplication()` (a brand-new account created and applying
   *  in the same step, from the dedicated signup journey). */
  private createApplicationRecord(
    userId: string,
    name: string,
    email: string,
    input: ApplyDeliveryPartnerInput,
  ) {
    return this.repo.createApplication({
      userId,
      name,
      email,
      country: input.country,
      customFields: input.customFields as Prisma.InputJsonValue,
      status: "PENDING",
    });
  }

  /** Used by the dedicated delivery-partner signup journey (AuthService,
   *  right after the account is created) — a brand-new user can't already
   *  have a pending application, so this skips straight to creating it. */
  async createSignupApplication(
    userId: string,
    name: string,
    email: string,
    input: DeliveryPartnerSignupInput,
  ): Promise<void> {
    await this.createApplicationRecord(userId, name, email, input);
  }

  /** The caller's own latest application, in full (customFields + resolved
   *  document URLs) — powers the public status page. */
  async myApplication(user: RequestUser): Promise<DeliveryPartnerApplicationDto | null> {
    const app = await this.repo.findLatestApplicationByUser(user.id);
    if (!app) return null;
    return this.toAppDto(app);
  }

  private async findPendingApplicationOrThrow(userId: string) {
    const app = await this.repo.findPendingApplicationByUser(userId);
    if (!app) throw new BadRequestException("No pending application to attach documents to");
    return app;
  }

  async uploadDocument(
    user: RequestUser,
    title: string,
    file: ValidatedPartnerDocFile,
  ): Promise<PartnerDocumentDto> {
    const app = await this.findPendingApplicationOrThrow(user.id);
    const documents = parsePartnerDocuments(app.documents);
    if (documents.length >= PARTNER_DOC_MAX_COUNT) {
      throw new BadRequestException(`You can attach up to ${PARTNER_DOC_MAX_COUNT} documents`);
    }

    const key = `${PARTNER_DOC_KEY_PREFIX}/${user.id}/${ulid()}.${file.extension}`;
    const stored = await this.storage.put({
      key,
      body: file.buffer,
      contentType: file.mimeType,
      contentLength: file.size,
      originalName: file.originalName,
    });
    const doc = {
      title: title.trim(),
      key: stored.key,
      name: file.originalName,
      sizeLabel: humanSize(file.size),
    };
    await this.repo.updateApplicationDocuments(
      app.id,
      [...documents, doc] as Prisma.InputJsonValue,
    );
    return { ...doc, url: stored.url };
  }

  async deleteDocument(user: RequestUser, key: string): Promise<{ ok: true }> {
    if (!key.startsWith(`${PARTNER_DOC_KEY_PREFIX}/${user.id}/`)) {
      throw new ForbiddenException("Not your file");
    }
    const app = await this.findPendingApplicationOrThrow(user.id);
    const documents = parsePartnerDocuments(app.documents);
    await this.repo.updateApplicationDocuments(
      app.id,
      documents.filter((d) => d.key !== key) as Prisma.InputJsonValue,
    );
    await this.storage.delete(key).catch(() => undefined);
    return { ok: true };
  }

  // ── partner self ─────────────────────────────────────────────────────────
  /** A DeliveryPartner row only exists once an application is approved, so
   *  a pending or rejected applicant would otherwise see `null` here and the
   *  frontend would show the apply form again instead of their status. */
  async me(user: RequestUser): Promise<DeliveryPartnerDto | null> {
    const a = await this.repo.findPartnerByUserId(user.id);
    if (a) return this.toDto(a);

    const app = await this.repo.findLatestApplicationByUser(user.id);
    if (!app || app.status === "APPROVED") return null;

    return {
      id: app.id,
      userId: user.id,
      name: app.name,
      email: app.email,
      region: "",
      referralCode: "",
      commissionPercent: 0,
      status: app.status,
      totalEarningsCents: 0,
      pendingEarningsCents: 0,
      paidEarningsCents: 0,
      referralCount: 0,
      createdAt: app.appliedAt.toISOString(),
    };
  }

  async myReferrals(user: RequestUser): Promise<DeliveryPartnerReferralDto[]> {
    const partner = await this.repo.findPartnerIdByUserId(user.id);
    if (!partner) return [];
    return this.referralsForPartner(partner.id);
  }

  private async referralsForPartner(partnerId: string): Promise<DeliveryPartnerReferralDto[]> {
    const rows = await this.repo.findReferralsByPartner(partnerId);
    return rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      partnerId: r.partnerId,
      studentName: r.order.user.name,
      courseTitle: r.order.items.map((i) => i.titleSnapshot).join(", "),
      orderTotalCents: r.order.totalCents,
      commissionCents: r.commissionCents,
      status: r.status as "pending" | "confirmed" | "paid",
      createdAt: r.createdAt.toISOString(),
    }));
  }

  // ── admin ──────────────────────────────────────────────────────────────
  async listApplications(
    query: AdminDeliveryPartnerApplicationQuery,
  ): Promise<Paginated<DeliveryPartnerApplicationDto>> {
    const where: Prisma.DeliveryPartnerApplicationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { email: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.repo.findApplicationsPage(
      where,
      query.page,
      query.pageSize,
    );
    return {
      items: await Promise.all(rows.map((a) => this.toAppDto(a))),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async applicationStats(): Promise<DeliveryPartnerApplicationStatsDto> {
    const [pending, approved, rejected] = await this.repo.applicationStatusCounts();
    return { pending, approved, rejected };
  }

  async listPartners(query: AdminDeliveryPartnerQuery): Promise<Paginated<DeliveryPartnerDto>> {
    const where: Prisma.DeliveryPartnerWhereInput = query.q
      ? {
          OR: [
            { referralCode: { contains: query.q, mode: "insensitive" } },
            { user: { name: { contains: query.q, mode: "insensitive" } } },
            { user: { email: { contains: query.q, mode: "insensitive" } } },
          ],
        }
      : {};
    const [rows, total] = await this.repo.findPartnersPage(where, query.page, query.pageSize);
    return {
      items: rows.map((a) => this.toDto(a)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async updatePartner(partnerId: string, input: UpdatePartnerInput): Promise<DeliveryPartnerDto> {
    const a = await this.repo.updatePartner(partnerId, {
      commissionPercent: input.commissionPercent,
      status: input.status,
    });
    return this.toDto(a);
  }

  async reviewApplication(
    appId: string,
    input: ReviewPartnerApplicationInput,
  ): Promise<DeliveryPartnerApplicationDto> {
    const app = await this.repo.findApplicationById(appId);
    if (!app) throw new NotFoundException("Application not found");

    const result = await this.repo.runTransaction(async (tx) => {
      const updated = await this.repo.updateApplication(
        appId,
        { status: input.status, reviewedAt: new Date(), note: input.note },
        tx,
      );
      if (input.status === "APPROVED" && app.userId) {
        await this.repo.updateUserRole(app.userId, "DELIVERY_PARTNER", tx);
        await this.repo.upsertDeliveryPartner(
          app.userId,
          this.generateCode(),
          input.commissionPercent ?? 10,
          tx,
        );
      }
      return updated;
    });

    if (app.userId) {
      const approved = result.status === "APPROVED";
      const approvedBody = result.note
        ? `You're approved as a delivery partner — your referral code is ready. ${result.note}`
        : "You're approved as a delivery partner — your referral code is ready.";
      void this.notifications
        .notify({
          userId: app.userId,
          event: approved
            ? "DELIVERY_PARTNER_APPLICATION_APPROVED"
            : "DELIVERY_PARTNER_APPLICATION_REJECTED",
          title: approved ? "Delivery partner application approved" : "Delivery partner application update",
          body: approved
            ? approvedBody
            : (result.note ?? "Your delivery partner application was not approved this time."),
          href: approved ? "/delivery-partner/referrals" : "/partner",
        })
        .catch(() => undefined);
    }

    return this.toAppDto(result);
  }

  private generateCode(): string {
    return `REF-${randomUUID().slice(0, 6).toUpperCase()}`;
  }

  // ── referral attribution (called from checkout / fulfillment) ───────────
  /** Attaches a pending referral to a freshly-created order. No earnings are
   *  credited until the order is paid (see confirmReferral). */
  async createPendingReferral(
    orderId: string,
    referralCode: string,
  ): Promise<void> {
    const partner = await this.repo.findPartnerByReferralCode(referralCode);
    if (!partner || partner.status !== "APPROVED") return;

    const order = await this.repo.findOrderTotalById(orderId);
    if (!order) return;

    const exists = await this.repo.findReferralByOrderId(orderId);
    if (exists) return;

    const commissionCents = Math.round(
      order.totalCents * (partner.commissionPercent / 100),
    );
    await this.repo.createPendingReferralTx(
      partner.id,
      orderId,
      commissionCents,
      referralCode,
    );
  }

  /** Confirms a referral once its order is paid, crediting the partner's
   *  pending/total earnings. Idempotent. */
  async confirmReferral(orderId: string): Promise<void> {
    const referral = await this.repo.findReferralByOrderId(orderId);
    if (!referral || referral.status !== "pending") return;
    await this.repo.confirmReferralTx(
      orderId,
      referral.partnerId,
      referral.commissionCents,
    );
    void this.notifications
      .notify({
        userId: referral.partner.userId,
        event: "REFERRAL_CONFIRMED",
        title: "Referral confirmed",
        body: `A referral you sent just converted — $${(referral.commissionCents / 100).toFixed(2)} commission pending.`,
        href: "/delivery-partner/referrals",
      })
      .catch(() => undefined);
  }
}

/** Bytes → "1.2 MB" style. Mirrors the identical helper in InstructorService. */
function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIdx]}`;
}
