"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle({
  className,
  size = "icon",
}: {
  className?: string;
  size?: "icon" | "icon-sm";
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <Button
      variant="ghost"
      size={size}
      aria-label="Toggle theme"
      className={className}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {mounted && theme === "dark" ? (
        <Sun className={size === "icon-sm" ? "h-4 w-4" : "h-5 w-5"} />
      ) : (
        <Moon className={size === "icon-sm" ? "h-4 w-4" : "h-5 w-5"} />
      )}
    </Button>
  );
}
