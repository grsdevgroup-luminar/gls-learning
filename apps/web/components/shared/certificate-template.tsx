import { QRCodeSVG } from "qrcode.react";
import {
  CERTIFICATE_CONTACT_EMAIL,
  CERTIFICATE_WEBSITE,
} from "@/lib/certificate-config";

export type CertificateTemplateData = {
  studentName: string;
  courseName: string;
  certificateNumber: string;
  uniqueId: string;
  courseNumber: string;
  courseStartDate: string;
  courseEndDate: string;
  issueDate: string;
  verificationUrl: string;
  isoStandard?: string;
};

type CertificateTemplateProps = {
  data: CertificateTemplateData;
  variant?: "preview" | "print" | "small";
};

/** The source certificate is a fixed A4 artwork. The client-supplied static
 * artwork is kept as a background and the variable certificate fields are
 * overlaid at the source PDF's measured coordinates. */
export function CertificateTemplate({ data, variant = "preview" }: CertificateTemplateProps) {
  const courseDates = formatCourseDates(data.courseStartDate, data.courseEndDate);
  const hasIsoStandard = Boolean(data.isoStandard?.trim());
  const websiteLabel = CERTIFICATE_WEBSITE
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  return (
    <article
      className={`certificate-template certificate-template--${variant}${hasIsoStandard ? "" : " certificate-template--without-iso"}`}
      aria-label="Achievement Certificate"
    >
      <img className="certificate-template__background" src="/certificate/certificate-background-clean.png" alt="" aria-hidden="true" />
      <div className="certificate-template__footer" aria-label="Certificate issuer and verification details">
        <span>Issued by:</span>
        <span>GRS Learning</span>
        <span>Head Office: Suite 34, Benson House, 2 Benson Street, Toowong, QLD 4066, Australia,</span>
        <span className="certificate-template__footer-contact">
          Phone: (+61) 1300 007 477 | Email: <strong>{CERTIFICATE_CONTACT_EMAIL}</strong> | Web: <strong>{websiteLabel}</strong>
        </span>
        <span>Verification of this certificate can be found visiting the public link.</span>
      </div>
      <div className="certificate-template__qr" aria-label="Scan to verify this certificate">
        <QRCodeSVG value={data.verificationUrl} size={200} includeMargin bgColor="#ffffff" fgColor="#111111" />
      </div>
      <main className="certificate-template__content">
        <h1><span>Achievement</span> <strong>Certificate</strong></h1>
        <p className="certificate-template__intro">This is to certify that:</p>
        <p className="certificate-template__student" style={{ fontSize: fittedFontSize(data.studentName, 8.12, 5.6, 32) }}>{data.studentName}</p>
        <p className="certificate-template__completion">has successfully completed the course assessment and examination for the:</p>
        {hasIsoStandard ? (
          <p className="certificate-template__iso" style={{ fontSize: fittedFontSize(data.isoStandard!, 11.3, 6.4, 22) }}>{data.isoStandard}</p>
        ) : null}
        <h2 style={{ fontSize: fittedFontSize(data.courseName, 11.3, 6.4, 28) }}>{data.courseName}</h2>
        <p className="certificate-template__certification">
          This Course is certified by <strong>Exemplar Global</strong> for Training of<br />
          Occupational Health &amp; Safety Management Systems.
        </p>
        <section className="certificate-template__metadata" aria-label="Certificate details">
          <MetadataItem label="Certificate Number" value={data.certificateNumber} />
          <MetadataItem label="Unique ID Number" value={data.uniqueId} />
          <MetadataItem label="Course Number" value={data.courseNumber} />
          <MetadataItem label="Course Dates" value={courseDates} />
          <MetadataItem label="Issue Date" value={data.issueDate} />
        </section>
        <p className="certificate-template__validity">This certificate is valid for five (5) years from the date of issue for registration as a Principal Auditor.</p>
      </main>
    </article>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return <p className="certificate-template__metadata-item"><span>{label}</span><strong>{value || "-"}</strong></p>;
}

function formatCourseDates(startDate: string, endDate: string) {
  if (startDate && endDate) return `${startDate} TO ${endDate}`;
  return startDate || endDate || "-";
}

function fittedFontSize(value: string, max: number, min: number, idealLength: number) {
  const excess = Math.max(0, value.trim().length - idealLength);
  return `${Math.max(min, max - excess * 0.11)}mm`;
}
