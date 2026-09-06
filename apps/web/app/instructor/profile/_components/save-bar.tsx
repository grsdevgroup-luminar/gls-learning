"use client";

import { Magnetic } from "@/components/shared/motion";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

// Fixed so "Save profile" stays reachable without scrolling past five cards —
// sticky wouldn't help here since it only pins once its own natural position
// nears the viewport edge.
export function SaveBar({ pending, onSave }: { pending: boolean; onSave: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur supports-backdrop-filter:bg-background/85 md:left-64 md:px-8">
      <div className="mx-auto flex max-w-5xl items-center justify-end gap-4">
        <Magnetic strength={0.15}>
          <Button className="sheen" onClick={onSave} disabled={pending}>
            <Save /> {pending ? "Saving…" : "Save profile"}
          </Button>
        </Magnetic>
      </div>
    </div>
  );
}
