import type { Metadata } from "next";
import CertificatesClient from "./page-client";

export const metadata: Metadata = { title: "Certificates" };

export default function CertificatesPage() {
  return <CertificatesClient />;
}
