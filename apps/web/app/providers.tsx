"use client";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AuroraField } from "@/components/shared/motion";
import { QueryProvider } from "@/lib/api/query-provider";
import { SessionProvider } from "@/lib/api/session";
import { StoreProvider } from "@/lib/context/store";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryProvider>
        <SessionProvider>
          <StoreProvider>
            <TooltipProvider delay={150}>
              <AuroraField />
              {children}
              <Toaster richColors position="top-center" />
            </TooltipProvider>
          </StoreProvider>
        </SessionProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
