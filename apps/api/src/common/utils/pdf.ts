/**
 * Minimal single-page PDF writer — enough for certificates and receipts, which
 * are a handful of text lines and a border. Writing the ~70 lines of PDF
 * syntax here avoids pulling in a PDF toolkit (pdfkit/puppeteer) that would
 * dwarf the feature it serves.
 *
 * Only the base-14 fonts (Helvetica / Helvetica-Bold) are used, so no font
 * embedding is needed and the output is deterministic.
 */

export type PdfAlign = "left" | "center" | "right";

export interface PdfLine {
  text: string;
  /** Distance from the *bottom* of the page, in points (PDF origin). */
  y: number;
  /** Left edge (or anchor for centered/right text). Defaults to page centre. */
  x?: number;
  size?: number;
  bold?: boolean;
  align?: PdfAlign;
  /** 0 = black, 1 = white. */
  gray?: number;
}

export interface PdfRect {
  x: number;
  y: number;
  w: number;
  h: number;
  gray?: number;
  fillGray?: number;
  lineWidth?: number;
}

export interface PdfCircle {
  x: number;
  y: number;
  r: number;
  gray?: number;
  fillGray?: number;
  lineWidth?: number;
}

export interface PdfPage {
  width: number;
  height: number;
  lines: PdfLine[];
  rects?: PdfRect[];
  circles?: PdfCircle[];
}

/**
 * Approximate Helvetica advance width. The real answer needs per-glyph AFM
 * metrics; for centring a title this is within a couple of points.
 * ponytail: naive metric — swap in AFM widths if text ever needs to align to a
 * column or wrap.
 */
function textWidth(text: string, size: number, bold: boolean): number {
  return text.length * size * (bold ? 0.55 : 0.5);
}

/** PDF strings are latin-1 byte strings; `(`, `)` and `\` must be escaped. */
function escapeText(text: string): string {
  return [...text]
    .map((ch) => (ch.charCodeAt(0) > 255 ? "?" : ch))
    .join("")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function contentStream(page: PdfPage): string {
  const ops: string[] = [];

  for (const r of page.rects ?? []) {
    const g = r.gray ?? 0;
    if (r.fillGray !== undefined)
      ops.push(`${r.fillGray} g ${r.x} ${r.y} ${r.w} ${r.h} re f`);
    ops.push(`${g} G ${r.lineWidth ?? 1} w ${r.x} ${r.y} ${r.w} ${r.h} re S`);
  }

  for (const c of page.circles ?? []) {
    const k = 0.5522847498;
    const cp = c.r * k;
    const path = [
      `${(c.x + c.r).toFixed(2)} ${c.y.toFixed(2)} m`,
      `${(c.x + c.r).toFixed(2)} ${(c.y + cp).toFixed(2)} ${(c.x + cp).toFixed(2)} ${(c.y + c.r).toFixed(2)} ${c.x.toFixed(2)} ${(c.y + c.r).toFixed(2)} c`,
      `${(c.x - cp).toFixed(2)} ${(c.y + c.r).toFixed(2)} ${(c.x - c.r).toFixed(2)} ${(c.y + cp).toFixed(2)} ${(c.x - c.r).toFixed(2)} ${c.y.toFixed(2)} c`,
      `${(c.x - c.r).toFixed(2)} ${(c.y - cp).toFixed(2)} ${(c.x - cp).toFixed(2)} ${(c.y - c.r).toFixed(2)} ${c.x.toFixed(2)} ${(c.y - c.r).toFixed(2)} c`,
      `${(c.x + cp).toFixed(2)} ${(c.y - c.r).toFixed(2)} ${(c.x + c.r).toFixed(2)} ${(c.y - cp).toFixed(2)} ${(c.x + c.r).toFixed(2)} ${c.y.toFixed(2)} c`,
    ].join(" ");
    if (c.fillGray !== undefined) ops.push(`${c.fillGray} g ${path} f`);
    ops.push(`${c.gray ?? 0} G ${c.lineWidth ?? 1} w ${path} S`);
  }

  for (const line of page.lines) {
    const size = line.size ?? 12;
    const font = line.bold ? "/F2" : "/F1";
    const width = textWidth(line.text, size, !!line.bold);
    const anchor = line.x ?? page.width / 2;
    const align = line.align ?? (line.x === undefined ? "center" : "left");
    const x =
      align === "center"
        ? anchor - width / 2
        : align === "right"
          ? anchor - width
          : anchor;
    ops.push(
      `BT ${line.gray ?? 0} g ${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${line.y} Tm (${escapeText(line.text)}) Tj ET`,
    );
  }

  return ops.join("\n");
}

export function buildPdf(page: PdfPage): Buffer {
  const stream = contentStream(page);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

const LONG_DATE: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
};

/** Landscape A4 certificate of completion. */
export function certificatePdf(input: {
  learnerName: string;
  courseTitle: string;
  issuedAt: Date;
  serial: string;
  verifyUrl: string;
}): Buffer {
  const width = 842;
  const height = 595;
  const issuedDate = input.issuedAt.toLocaleDateString("en-US", LONG_DATE);
  const texture: PdfCircle[] = [];
  for (let x = 62; x <= width - 62; x += 28) {
    for (let y = 62; y <= height - 62; y += 28) {
      texture.push({ x, y, r: 0.65, fillGray: 0.88, gray: 0.88, lineWidth: 0.1 });
    }
  }
  return buildPdf({
    width,
    height,
    rects: [
      { x: 0, y: 0, w: width, h: height, fillGray: 0.985, gray: 0.985, lineWidth: 0.1 },
      { x: 24, y: 24, w: width - 48, h: height - 48, gray: 0.55, lineWidth: 1.4 },
      { x: 38, y: 38, w: width - 76, h: height - 76, gray: 0.78, lineWidth: 0.6 },
      { x: 58, y: 58, w: width - 116, h: height - 116, gray: 0.9, lineWidth: 0.45 },
      { x: 196, y: 170, w: 450, h: 0.1, gray: 0.64, lineWidth: 0.8 },
      { x: 331, y: 96, w: 180, h: 0.1, gray: 0.64, lineWidth: 0.8 },
      { x: 130, y: 96, w: 175, h: 0.1, gray: 0.72, lineWidth: 0.7 },
      { x: 537, y: 96, w: 175, h: 0.1, gray: 0.72, lineWidth: 0.7 },
    ],
    circles: [
      ...texture,
      { x: width / 2, y: 190, r: 37, fillGray: 0.94, gray: 0.62, lineWidth: 1.6 },
      { x: width / 2, y: 190, r: 43, gray: 0.75, lineWidth: 0.8 },
      { x: width / 2, y: 190, r: 28, gray: 0.78, lineWidth: 0.6 },
    ],
    lines: [
      { text: "SKILLSTREAM ACADEMY", y: 505, size: 14, bold: true, gray: 0.28 },
      { text: "Certificate of Completion", y: 455, size: 34, bold: true },
      { text: "This certifies that", y: 400, size: 13, gray: 0.42 },
      { text: input.learnerName, y: 350, size: 30, bold: true },
      { text: "has successfully completed the course", y: 302, size: 13, gray: 0.42 },
      { text: input.courseTitle, y: 262, size: 20, bold: true, gray: 0.18 },
      { text: "VERIFIED", y: 184, size: 10, bold: true, gray: 0.35 },
      { text: "SkillStream", x: 217, y: 112, size: 13, bold: true, align: "center" },
      { text: "Issuing Platform", x: 217, y: 76, size: 9, gray: 0.45, align: "center" },
      { text: `Issued ${issuedDate}`, x: 624, y: 112, size: 12, bold: true, align: "center" },
      { text: "Date Issued", x: 624, y: 76, size: 9, gray: 0.45, align: "center" },
      { text: `Serial ${input.serial}`, y: 130, size: 10, gray: 0.45 },
      { text: `Verify at ${input.verifyUrl}`, y: 52, size: 8, gray: 0.45 },
    ],
  });
}

const money = (cents: number, currency: string) =>
  `${currency} ${(cents / 100).toFixed(2)}`;

/** Portrait A4 payment receipt for a paid order. */
export function receiptPdf(input: {
  orderId: string;
  buyerName: string;
  buyerEmail: string;
  createdAt: Date;
  paidAt: Date | null;
  status: string;
  gateway: string;
  currency: string;
  couponCode: string | null;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  /** Cumulative store-credit refund granted on this order. */
  refundedCents?: number;
  items: { title: string; priceCents: number; refundedCents?: number }[];
}): Buffer {
  const width = 595;
  const height = 842;
  const left = 60;
  const right = width - 60;
  const lines: PdfLine[] = [
    { text: "SkillStream", x: left, y: 770, size: 20, bold: true },
    { text: "Receipt", x: right, y: 770, size: 20, bold: true, align: "right" },
    { text: `Order ${input.orderId}`, x: left, y: 740, size: 10, gray: 0.4 },
    {
      text: `Date ${(input.paidAt ?? input.createdAt).toLocaleDateString("en-US", LONG_DATE)}`,
      x: right,
      y: 740,
      size: 10,
      gray: 0.4,
      align: "right",
    },
    { text: `Billed to ${input.buyerName} (${input.buyerEmail})`, x: left, y: 700, size: 11 },
    {
      text: `Payment ${input.gateway} · ${input.status}`,
      x: left,
      y: 682,
      size: 11,
      gray: 0.4,
    },
    { text: "Description", x: left, y: 640, size: 10, bold: true, gray: 0.4 },
    { text: "Amount", x: right, y: 640, size: 10, bold: true, gray: 0.4, align: "right" },
  ];

  let y = 615;
  for (const item of input.items) {
    lines.push({ text: item.title, x: left, y, size: 11 });
    lines.push({
      text: money(item.priceCents, input.currency),
      x: right,
      y,
      size: 11,
      align: "right",
    });
    y -= 16;
    if (item.refundedCents && item.refundedCents > 0) {
      // Per-item refund line, shown right under its parent so it is obvious
      // which course received store credit and how much.
      const fully = item.refundedCents >= item.priceCents;
      lines.push({
        text: fully
          ? "  Refunded to store credit (access revoked)"
          : "  Partially refunded to store credit",
        x: left,
        y,
        size: 10,
        gray: 0.45,
      });
      lines.push({
        text: `-${money(item.refundedCents, input.currency)}`,
        x: right,
        y,
        size: 10,
        gray: 0.45,
        align: "right",
      });
      y -= 16;
    }
    y -= 6;
  }

  y -= 12;
  lines.push({ text: "Subtotal", x: left, y, size: 11, gray: 0.4 });
  lines.push({
    text: money(input.subtotalCents, input.currency),
    x: right,
    y,
    size: 11,
    align: "right",
  });
  if (input.discountCents > 0) {
    y -= 20;
    const label = input.couponCode ? `Discount (${input.couponCode})` : "Discount";
    lines.push({ text: label, x: left, y, size: 11, gray: 0.4 });
    lines.push({
      text: `-${money(input.discountCents, input.currency)}`,
      x: right,
      y,
      size: 11,
      align: "right",
    });
  }
  y -= 26;
  lines.push({ text: "Total", x: left, y, size: 14, bold: true });
  lines.push({
    text: money(input.totalCents, input.currency),
    x: right,
    y,
    size: 14,
    bold: true,
    align: "right",
  });

  const refundedTotal = input.refundedCents ?? 0;
  if (refundedTotal > 0) {
    // Order-level refund summary + net-paid so the buyer sees, in dollars,
    // exactly what has been credited back and what has actually been retained.
    y -= 22;
    lines.push({
      text: "Refunded to store credit",
      x: left,
      y,
      size: 11,
      gray: 0.4,
    });
    lines.push({
      text: `-${money(refundedTotal, input.currency)}`,
      x: right,
      y,
      size: 11,
      gray: 0.4,
      align: "right",
    });
    y -= 22;
    const net = Math.max(0, input.totalCents - refundedTotal);
    lines.push({ text: "Net paid", x: left, y, size: 12, bold: true });
    lines.push({
      text: money(net, input.currency),
      x: right,
      y,
      size: 12,
      bold: true,
      align: "right",
    });
  }

  lines.push({
    text: "Thank you for learning with SkillStream.",
    x: left,
    y: 90,
    size: 10,
    gray: 0.45,
  });

  return buildPdf({
    width,
    height,
    rects: [{ x: left, y: y - 16, w: right - left, h: 0.1, gray: 0.7, lineWidth: 0.5 }],
    lines,
  });
}
