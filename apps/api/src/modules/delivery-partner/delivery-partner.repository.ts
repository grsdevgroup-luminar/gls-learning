import { Injectable } from "@nestjs/common";
import { Prisma, DeliveryPartnerStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { Db } from "../../common/types";

export const partnerSelect = {
  id: true,
  userId: true,
  referralCode: true,
  commissionPercent: true,
  region: true,
  status: true,
  totalEarningsCents: true,
  pendingEarningsCents: true,
  paidEarningsCents: true,
  referralCount: true,
  createdAt: true,
  user: { select: { name: true, email: true } },
} satisfies Prisma.DeliveryPartnerSelect;

export type DeliveryPartnerRow = Prisma.DeliveryPartnerGetPayload<{
  select: typeof partnerSelect;
}>;

@Injectable()
export class DeliveryPartnerRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Db) {
    return tx ?? this.prisma;
  }

  findUserByIdOrThrow(userId: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  }

  findPendingApplicationByUser(userId: string) {
    return this.prisma.deliveryPartnerApplication.findFirst({
      where: { userId, status: "PENDING" },
    });
  }

  /** Most recent application regardless of status — lets `me()` reflect a
   *  pending or rejected application before any DeliveryPartner row exists (that
   *  row is only created on approval). */
  findLatestApplicationByUser(userId: string) {
    return this.prisma.deliveryPartnerApplication.findFirst({
      where: { userId },
      orderBy: { appliedAt: "desc" },
    });
  }

  createApplication(
    data: Prisma.DeliveryPartnerApplicationUncheckedCreateInput,
  ) {
    return this.prisma.deliveryPartnerApplication.create({ data });
  }

  findApplicationsPage(
    where: Prisma.DeliveryPartnerApplicationWhereInput,
    page: number,
    pageSize: number,
  ) {
    return this.prisma.$transaction([
      this.prisma.deliveryPartnerApplication.findMany({
        where,
        orderBy: { appliedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.deliveryPartnerApplication.count({ where }),
    ]);
  }

  applicationStatusCounts() {
    return this.prisma.$transaction([
      this.prisma.deliveryPartnerApplication.count({ where: { status: "PENDING" } }),
      this.prisma.deliveryPartnerApplication.count({ where: { status: "APPROVED" } }),
      this.prisma.deliveryPartnerApplication.count({ where: { status: "REJECTED" } }),
    ]);
  }

  findApplicationById(appId: string) {
    return this.prisma.deliveryPartnerApplication.findUnique({
      where: { id: appId },
    });
  }

  runTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(fn);
  }

  updateApplication(
    appId: string,
    data: Prisma.DeliveryPartnerApplicationUpdateInput,
    tx?: Db,
  ) {
    return this.db(tx).deliveryPartnerApplication.update({
      where: { id: appId },
      data,
    });
  }

  updateUserRole(
    userId: string,
    role: Prisma.UserUpdateInput["role"],
    tx?: Db,
  ) {
    return this.db(tx).user.update({
      where: { id: userId },
      data: { role },
    });
  }

  upsertDeliveryPartner(
    userId: string,
    referralCode: string,
    commissionPercent: number,
    tx?: Db,
  ) {
    return this.db(tx).deliveryPartner.upsert({
      where: { userId },
      update: { status: "APPROVED" },
      create: {
        userId,
        referralCode,
        status: "APPROVED",
        commissionPercent,
      },
    });
  }

  findPartnerByUserId(userId: string) {
    return this.prisma.deliveryPartner.findUnique({
      where: { userId },
      select: partnerSelect,
    });
  }

  findPartnerIdByUserId(userId: string) {
    return this.prisma.deliveryPartner.findUnique({
      where: { userId },
      select: { id: true },
    });
  }

  findReferralsByPartner(partnerId: string) {
    return this.prisma.deliveryPartnerReferral.findMany({
      where: { partnerId },
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          include: { user: { select: { name: true } }, items: true },
        },
      },
    });
  }

  findPartnersPage(
    where: Prisma.DeliveryPartnerWhereInput,
    page: number,
    pageSize: number,
  ) {
    return this.prisma.$transaction([
      this.prisma.deliveryPartner.findMany({
        where,
        select: partnerSelect,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.deliveryPartner.count({ where }),
    ]);
  }

  updatePartner(partnerId: string, data: Prisma.DeliveryPartnerUpdateInput) {
    return this.prisma.deliveryPartner.update({
      where: { id: partnerId },
      data,
      select: partnerSelect,
    });
  }

  findPartnerByReferralCode(referralCode: string) {
    return this.prisma.deliveryPartner.findUnique({
      where: { referralCode },
    });
  }

  findOrderTotalById(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      select: { totalCents: true },
    });
  }

  findReferralByOrderId(orderId: string) {
    return this.prisma.deliveryPartnerReferral.findUnique({
      where: { orderId },
      include: { partner: { select: { userId: true } } },
    });
  }

  createPendingReferralTx(
    partnerId: string,
    orderId: string,
    commissionCents: number,
    referralCode: string,
  ) {
    return this.prisma.$transaction([
      this.prisma.deliveryPartnerReferral.create({
        data: { partnerId, orderId, commissionCents, status: "pending" },
      }),
      this.prisma.deliveryPartner.update({
        where: { id: partnerId },
        data: { referralCount: { increment: 1 } },
      }),
      // Stamp the order so reporting can join on partnerId without going through the referral table.
      this.prisma.order.update({
        where: { id: orderId },
        data: { partnerId, partnerReferralCode: referralCode },
      }),
    ]);
  }

  updateApplicationDocuments(applicationId: string, documents: Prisma.InputJsonValue) {
    return this.prisma.deliveryPartnerApplication.update({
      where: { id: applicationId },
      data: { documents },
    });
  }

  confirmReferralTx(
    orderId: string,
    partnerId: string,
    commissionCents: number,
  ) {
    return this.prisma.$transaction([
      this.prisma.deliveryPartnerReferral.update({
        where: { orderId },
        data: { status: "confirmed" },
      }),
      this.prisma.deliveryPartner.update({
        where: { id: partnerId },
        data: {
          pendingEarningsCents: { increment: commissionCents },
          totalEarningsCents: { increment: commissionCents },
        },
      }),
    ]);
  }
}
