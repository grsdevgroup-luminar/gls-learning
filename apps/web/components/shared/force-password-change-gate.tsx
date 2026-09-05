"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/api/session";

const EXEMPT_PATH = "/force-password-change";

/**
 * Global catch-all for an admin-provisioned account that reloads on some
 * other route while still flagged `mustChangePassword` — the login page's own
 * redirect only fires right after a fresh login, not on a deep link with an
 * already-valid session cookie. Every API call would otherwise 403 silently.
 */
export function ForcePasswordChangeGate() {
  const { user } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (user?.mustChangePassword && pathname !== EXEMPT_PATH) {
      router.replace(EXEMPT_PATH);
    }
  }, [user?.mustChangePassword, pathname, router]);

  return null;
}
