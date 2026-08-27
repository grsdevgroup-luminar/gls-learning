import type { Metadata } from "next";
import SettingsClient from "./page-client";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <SettingsClient />;
}
