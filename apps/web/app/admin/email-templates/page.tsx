import type { Metadata } from "next";
import EmailTemplatesClient from "./page-client";

export const metadata: Metadata = { title: "Email Templates" };

export default function EmailTemplatesPage() {
  return <EmailTemplatesClient />;
}
