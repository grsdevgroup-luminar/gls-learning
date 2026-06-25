"use client";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { StoreProvider } from "@/lib/context/store";
import { DemoBar } from "@/components/shared/demo-bar";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <StoreProvider>
        <TooltipProvider delay={150}>
          {children}
          <DemoBar />
          <Toaster richColors position="top-center" />
        </TooltipProvider>
      </StoreProvider>
    </ThemeProvider>
  );
}
