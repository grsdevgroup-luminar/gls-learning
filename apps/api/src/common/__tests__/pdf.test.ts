import { describe, it, expect } from "vitest";
import { buildPdf, certificatePdf, receiptPdf } from "../utils/pdf";

/** Parses the xref table back out and checks each offset points at "<n> 0 obj". */
function assertXrefIsSound(pdf: Buffer): void {
  const text = pdf.toString("latin1");
  const startxref = Number(text.slice(text.lastIndexOf("startxref") + 9).trim().split("\n")[0]);
  expect(text.slice(startxref, startxref + 4)).toBe("xref");

  const table = text.slice(startxref).split("\n");
  const count = Number(table[1].split(" ")[1]);
  // table[0] = "xref", table[1] = "0 <count>", table[2] = the free entry,
  // then one row per object in order.
  for (let i = 1; i < count; i++) {
    const offset = Number(table[i + 2].slice(0, 10));
    expect(text.slice(offset, offset + `${i} 0 obj`.length)).toBe(`${i} 0 obj`);
  }
}

describe("buildPdf", () => {
  it("emits a structurally valid PDF with a resolvable xref table", () => {
    const pdf = buildPdf({
      width: 200,
      height: 100,
      lines: [{ text: "hello", y: 50 }],
      rects: [{ x: 5, y: 5, w: 190, h: 90 }],
    });
    expect(pdf.subarray(0, 8).toString()).toBe("%PDF-1.4");
    expect(pdf.toString("latin1")).toContain("%%EOF");
    assertXrefIsSound(pdf);
  });

  it("escapes characters that would otherwise break the string syntax", () => {
    const pdf = buildPdf({
      width: 200,
      height: 100,
      lines: [{ text: "a(b)c\\d", y: 10 }],
    }).toString("latin1");
    expect(pdf).toContain("(a\\(b\\)c\\\\d)");
    // The stream /Length must match the bytes actually written, or readers fail.
    const declared = Number(/\/Length (\d+)/.exec(pdf)![1]);
    const stream = pdf.slice(pdf.indexOf("stream\n") + 7, pdf.indexOf("\nendstream"));
    expect(Buffer.byteLength(stream, "latin1")).toBe(declared);
  });

  it("drops non-latin1 characters instead of emitting invalid bytes", () => {
    const pdf = buildPdf({
      width: 200,
      height: 100,
      lines: [{ text: "café 🎓", y: 10 }],
    }).toString("latin1");
    expect(pdf).toContain("(café ?)");
  });
});

describe("certificatePdf", () => {
  it("includes the learner, course, serial and verification URL", () => {
    const pdf = certificatePdf({
      learnerName: "Ada Lovelace",
      courseTitle: "Advanced TypeScript",
      issuedAt: new Date("2026-03-04T12:00:00Z"),
      serial: "CERT-9F2C71A0B4D3",
      verifyUrl: "https://skillstream.dev/verify/CERT-9F2C71A0B4D3",
    }).toString("latin1");

    expect(pdf).toContain("(Ada Lovelace)");
    expect(pdf).toContain("(Advanced TypeScript)");
    expect(pdf).toContain("(Serial CERT-9F2C71A0B4D3)");
    expect(pdf).toContain("(Issued March 4, 2026)");
    expect(pdf).toContain("skillstream.dev/verify/CERT-9F2C71A0B4D3");
  });
});

describe("receiptPdf", () => {
  const order = {
    orderId: "ord_1",
    buyerName: "Ada Lovelace",
    buyerEmail: "ada@example.com",
    createdAt: new Date("2026-03-01T00:00:00Z"),
    paidAt: new Date("2026-03-02T00:00:00Z"),
    status: "PAID",
    gateway: "STRIPE",
    currency: "USD",
    couponCode: "LAUNCH20",
    subtotalCents: 10_000,
    discountCents: 2_000,
    totalCents: 8_000,
    items: [{ title: "Advanced TypeScript", priceCents: 10_000 }],
  };

  it("renders line items and totals in major units", () => {
    const pdf = receiptPdf(order).toString("latin1");
    expect(pdf).toContain("(USD 100.00)"); // line item + subtotal
    expect(pdf).toContain("(-USD 20.00)"); // discount
    expect(pdf).toContain("(USD 80.00)"); // total
    expect(pdf).toContain("(Discount \\(LAUNCH20\\))");
    expect(pdf).toContain("(Date March 2, 2026)"); // paid date wins over created
    assertXrefIsSound(receiptPdf(order));
  });

  it("omits the discount row when nothing was discounted", () => {
    const pdf = receiptPdf({
      ...order,
      couponCode: null,
      discountCents: 0,
      totalCents: 10_000,
    }).toString("latin1");
    expect(pdf).not.toContain("(Discount");
  });
});
