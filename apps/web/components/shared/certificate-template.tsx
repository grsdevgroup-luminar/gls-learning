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
  return (
    <article className={`certificate-template certificate-template--${variant}`} aria-label="Achievement Certificate">
      <img className="certificate-template__background" src="/certificate/client-background.jpg" alt="" aria-hidden="true" />
      <main className="certificate-template__content">
        <h1><span>Achievement</span> <strong>Certificate</strong></h1>
        <p className="certificate-template__intro">This is to certify that:</p>
        <p className="certificate-template__student" style={{ fontSize: fittedFontSize(data.studentName, 8.12, 5.6, 32) }}>{data.studentName}</p>
        <p className="certificate-template__completion">has successfully completed the course assessment and examination for the:</p>
        <p className="certificate-template__iso" style={{ fontSize: fittedFontSize(data.isoStandard || "ISO Standard not specified", 11.3, 6.4, 22) }}>{data.isoStandard || "ISO Standard not specified"}</p>
        <h2 style={{ fontSize: fittedFontSize(data.courseName, 11.3, 6.4, 28) }}>{data.courseName}</h2>
        <p className="certificate-template__certification">
          This Course is certified by <strong>Exemplar Global</strong> for Training of<br />
          Occupational Health &amp; Safety Management Systems.
        </p>
        <section className="certificate-template__metadata" aria-label="Certificate details">
          <MetadataItem label="Certificate Number" value={data.certificateNumber} />
          <MetadataItem label="Unique ID Number" value={data.uniqueId} />
          <MetadataItem label="Course Number" value={data.courseNumber} />
          <MetadataItem label="Course Dates" value={`${data.courseStartDate} TO ${data.courseEndDate}`} />
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

function fittedFontSize(value: string, max: number, min: number, idealLength: number) {
  const excess = Math.max(0, value.trim().length - idealLength);
  return `${Math.max(min, max - excess * 0.11)}mm`;
}
