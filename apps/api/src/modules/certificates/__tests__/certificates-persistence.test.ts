import type { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import type { Env } from "../../../config/env";
import { CertificatesService } from "../certificates.service";
import type { CertificatesRepository } from "../certificates.repository";

const issuedAt = new Date("2026-09-01T12:00:00.000Z");

const certRow = {
  serial: "CERT-ABC123DEF456",
  learnerName: "Ada Lovelace",
  issuedAt,
  enrollment: {
    course: {
      title: "Advanced TypeScript",
      slug: "advanced-typescript",
    },
  },
};

function makeService(repo: Partial<CertificatesRepository>) {
  const repository = {
    findBySerial: vi.fn().mockResolvedValue(certRow),
    ...repo,
  } as unknown as CertificatesRepository;

  const config = {
    get: vi.fn((key: keyof Env) => {
      if (key === "FRONTEND_URL") return "https://app.example";
      if (key === "API_BASE_URL") return "https://api.example";
      return undefined;
    }),
  } as unknown as ConfigService<Env, true>;

  return {
    service: new CertificatesService(repository, config),
    repository,
  };
}

describe("CertificatesService persistence after progress changes", () => {
  it("verify resolves a certificate by serial after it would have been retained", async () => {
    const { service, repository } = makeService({});

    const result = await service.verify(certRow.serial);

    expect(repository.findBySerial).toHaveBeenCalledWith(certRow.serial);
    expect(result).toEqual({
      valid: true,
      serial: certRow.serial,
      learnerName: certRow.learnerName,
      courseTitle: certRow.enrollment.course.title,
      courseSlug: certRow.enrollment.course.slug,
      issuedAt: issuedAt.toISOString(),
    });
  });

  it("pdf renders for a retained certificate serial", async () => {
    const { service } = makeService({});

    const pdf = await service.pdf(certRow.serial);

    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
