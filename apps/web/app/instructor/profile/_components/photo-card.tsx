"use client";

import type { RefObject } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Reveal } from "@/components/shared/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { initials } from "@/lib/format";
import { Upload, Trash2 } from "lucide-react";

// Kept in sync with AVATAR_MAX_BYTES on the API.
export const AVATAR_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

export function PhotoCard({
  name,
  title,
  avatar,
  fileInputRef,
  onFilePicked,
  onRemove,
  uploading,
  removing,
}: {
  name: string;
  title: string;
  avatar: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFilePicked: (file: File | undefined) => void;
  onRemove: () => void;
  uploading: boolean;
  removing: boolean;
}) {
  return (
    <Reveal y={20}>
      <Card>
        <CardHeader><CardTitle className="text-base">Photo</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
          <Avatar className="size-16 ring-1 ring-border transition-transform duration-300 hover:scale-105">
            {avatar && <AvatarImage src={avatar} alt="" />}
            <AvatarFallback className="brand-gradient text-xl text-white">{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="break-words font-heading text-lg font-semibold">{name}</div>
            <div className="break-words text-sm text-muted-foreground">{title || "Your professional headline"}</div>
          </div>
          <div className="min-w-0 sm:justify-self-end">
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={AVATAR_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  onFilePicked(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading…" : avatar ? "Change photo" : "Upload photo"}
              </Button>
              {avatar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={removing}
                  onClick={onRemove}
                >
                  <Trash2 className="h-4 w-4" />
                  {removing ? "Removing…" : "Remove"}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">PNG, JPG, WebP, or GIF. Max 5 MB.</p>
          </div>
        </CardContent>
      </Card>
    </Reveal>
  );
}
