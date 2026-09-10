import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Liquid } from "liquidjs";
import { PrismaService } from "../../prisma/prisma.service";
import { EMAIL_TEMPLATES, type EmailTemplateDefinition } from "./email-templates.registry";
import { escapeHtml, renderEmailLayout } from "./email-layout";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface EmailTemplateSummary extends EmailTemplateDefinition {
  isCustomized: boolean;
  subject: string;
  body: string;
  ctaLabel?: string;
  updatedAt?: string;
  updatedByName?: string | null;
}

export interface UpsertEmailTemplateInput {
  subject: string;
  body: string;
  ctaLabel?: string;
}

const TAG_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Extracts `{{tag}}` names referenced in a string. Simple regex, not a full
 *  Liquid parse — matches the same subset of syntax the admin UI teaches. */
function referencedTags(text: string): string[] {
  return [...text.matchAll(TAG_PATTERN)].map((m) => m[1]);
}

function unknownTags(def: EmailTemplateDefinition, subject: string, body: string): string[] {
  const allowed = new Set(def.variables.map((v) => v.name));
  return [...new Set([...referencedTags(subject), ...referencedTags(body)])].filter(
    (tag) => !allowed.has(tag),
  );
}

function findDefinition(key: string): EmailTemplateDefinition {
  const def = EMAIL_TEMPLATES[key];
  if (!def) throw new NotFoundException(`Unknown email template key: ${key}`);
  return def;
}

@Injectable()
export class EmailTemplatesService {
  // Unescaped on purpose: the rendered `subject`/body text doubles as the
  // real email Subject header and the plain-text alternative, neither of
  // which is HTML — escaping happens once, separately, only when building
  // the HTML rendition below.
  private readonly liquid = new Liquid();

  constructor(private readonly prisma: PrismaService) {}

  async render(
    key: string,
    vars: Record<string, unknown>,
    opts: { ctaHref?: string; protectedHtml?: string } = {},
  ): Promise<RenderedEmail> {
    const def = findDefinition(key);
    const override = await this.prisma.emailTemplate.findUnique({ where: { key } });
    return this.compose(
      def,
      override?.subject ?? def.defaultSubject,
      override?.body ?? def.defaultBody,
      override?.ctaLabel ?? def.ctaLabel,
      vars,
      opts,
    );
  }

  private async compose(
    def: EmailTemplateDefinition,
    subjectSrc: string,
    bodySrc: string,
    ctaLabel: string | undefined,
    vars: Record<string, unknown>,
    opts: { ctaHref?: string; protectedHtml?: string },
  ): Promise<RenderedEmail> {
    const subject: string = await this.liquid.parseAndRender(subjectSrc, vars);
    const renderedBody: string = await this.liquid.parseAndRender(bodySrc, vars);
    const paragraphs = renderedBody
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    const bodyHtml = paragraphs
      .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
      .join("");

    const html = renderEmailLayout({
      headline: escapeHtml(subject),
      bodyHtml,
      ctaLabel: opts.ctaHref ? ctaLabel : undefined,
      ctaHref: opts.ctaHref,
      protectedHtml: opts.protectedHtml,
    });
    const text = [paragraphs.join("\n\n"), opts.ctaHref].filter(Boolean).join("\n\n");

    return { subject, html, text };
  }

  async list(): Promise<EmailTemplateSummary[]> {
    const overrides = await this.prisma.emailTemplate.findMany({
      include: { updatedBy: { select: { name: true } } },
    });
    const byKey = new Map(overrides.map((o) => [o.key, o]));

    return Object.values(EMAIL_TEMPLATES).map((def) => {
      const override = byKey.get(def.key);
      return {
        ...def,
        isCustomized: !!override,
        subject: override?.subject ?? def.defaultSubject,
        body: override?.body ?? def.defaultBody,
        ctaLabel: override?.ctaLabel ?? def.ctaLabel,
        updatedAt: override?.updatedAt.toISOString(),
        updatedByName: override?.updatedBy?.name ?? null,
      };
    });
  }

  async get(key: string): Promise<EmailTemplateSummary> {
    const def = findDefinition(key);
    const override = await this.prisma.emailTemplate.findUnique({
      where: { key },
      include: { updatedBy: { select: { name: true } } },
    });
    return {
      ...def,
      isCustomized: !!override,
      subject: override?.subject ?? def.defaultSubject,
      body: override?.body ?? def.defaultBody,
      ctaLabel: override?.ctaLabel ?? def.ctaLabel,
      updatedAt: override?.updatedAt.toISOString(),
      updatedByName: override?.updatedBy?.name ?? null,
    };
  }

  async upsert(
    key: string,
    input: UpsertEmailTemplateInput,
    adminUserId: string,
  ): Promise<EmailTemplateSummary> {
    const def = findDefinition(key);
    const unknown = unknownTags(def, input.subject, input.body);
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown placeholder(s) for "${def.label}": ${unknown.map((t) => `{{${t}}}`).join(", ")}`,
      );
    }

    await this.prisma.emailTemplate.upsert({
      where: { key },
      create: { key, ...input, updatedByUserId: adminUserId },
      update: { ...input, updatedByUserId: adminUserId },
    });
    return this.get(key);
  }

  async resetToDefault(key: string): Promise<void> {
    findDefinition(key);
    await this.prisma.emailTemplate.deleteMany({ where: { key } });
  }

  /** Renders with sample data (from the registry) so the admin preview and
   *  "send test email" always work even before real data exists for a var.
   *  The CTA link is a placeholder — previews aren't meant to be clicked.
   *
   *  `draft`, when given, previews unsaved edits from the admin editor
   *  instead of the saved override/default — this is what makes the editor's
   *  preview pane live as the admin types, not just a preview of what's
   *  already saved. Same placeholder validation as `upsert` so a typo shows
   *  up before the admin ever tries to save it. */
  async preview(
    key: string,
    draft?: { subject: string; body: string; ctaLabel?: string },
  ): Promise<RenderedEmail> {
    const def = findDefinition(key);
    const sampleVars = Object.fromEntries(def.variables.map((v) => [v.name, v.sample]));
    const ctaHref = (draft?.ctaLabel ?? def.ctaLabel) ? "#" : undefined;
    const protectedHtml = def.sampleProtectedHtml;

    if (draft) {
      const unknown = unknownTags(def, draft.subject, draft.body);
      if (unknown.length > 0) {
        throw new BadRequestException(
          `Unknown placeholder(s) for "${def.label}": ${unknown.map((t) => `{{${t}}}`).join(", ")}`,
        );
      }
      return this.compose(def, draft.subject, draft.body, draft.ctaLabel ?? def.ctaLabel, sampleVars, {
        ctaHref,
        protectedHtml,
      });
    }
    return this.render(key, sampleVars, { ctaHref, protectedHtml });
  }
}
