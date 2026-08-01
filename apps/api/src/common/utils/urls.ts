import type { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";

const trim = (url: string) => url.replace(/\/+$/, "");

/** Absolute, externally reachable base URL of this API (includes the /api prefix). */
export function apiBaseUrl(config: ConfigService<Env, true>): string {
  const configured = config.get("PUBLIC_API_URL", { infer: true });
  return trim(configured ?? `http://localhost:${config.get("PORT", { infer: true })}/api`);
}

export const certificatePdfUrl = (apiBase: string, serial: string) =>
  `${trim(apiBase)}/certificates/${serial}/pdf`;

/** Public verification page on the web app (not the API). */
export const certificateVerifyUrl = (webBase: string, serial: string) =>
  `${trim(webBase)}/verify/${serial}`;
