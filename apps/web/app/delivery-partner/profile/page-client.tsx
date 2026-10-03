"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMyDeliveryPartner } from "@/lib/api/delivery-partner-hooks";
import { useSession, SESSION_QUERY_KEY } from "@/lib/api/session";
import { apiFetch, apiFetchMultipart } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  PartnerMissingState,
  PartnerPageLoading,
  PartnerStatusState,
} from "../_components/partner-page-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";
import { ChangePasswordCard } from "@/components/shared/change-password-card";
import { PhotoCard } from "@/app/instructor/profile/_components/photo-card";
import { toast } from "sonner";

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export default function PartnerProfile() {
  const { data: partner, isLoading } = useMyDeliveryPartner();
  const { user } = useSession();
  const qc = useQueryClient();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiFetchMultipart<{ avatar: string | null }>("/auth/me/avatar", form);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      router.refresh();
      toast.success("Photo updated");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteAvatar = useMutation({
    mutationFn: () =>
      apiFetch<{ avatar: string | null }>("/auth/me/avatar", { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      router.refresh();
      toast.success("Photo removed");
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  function handleAvatarPicked(file: File | undefined) {
    if (!file) return;
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("Photo must be under 5 MB");
      return;
    }
    uploadAvatar.mutate(file);
  }

  if (isLoading) return <PartnerPageLoading />;
  if (!partner) return <PartnerMissingState />;
  if (partner.status !== "APPROVED")
    return <PartnerStatusState status={partner.status} />;

  const statusColors: Record<string, string> = {
    APPROVED: "text-success",
    PENDING: "text-warning",
    REJECTED: "text-destructive",
    SUSPENDED: "text-muted-foreground",
  };
  const statusLabel =
    partner.status.charAt(0) + partner.status.slice(1).toLowerCase();

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Your partner details.</p>
      </div>

      <PhotoCard
        name={partner.name}
        title={partner.region || "Delivery partner"}
        avatar={user?.avatar ?? ""}
        fileInputRef={fileInputRef}
        onFilePicked={handleAvatarPicked}
        onRemove={() => deleteAvatar.mutate()}
        uploading={uploadAvatar.isPending}
        removing={deleteAvatar.isPending}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" /> Partner information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-xl font-bold text-primary">
              {partner.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <div className="font-semibold">{partner.name}</div>
              <div className="text-sm text-muted-foreground">
                {partner.email}
              </div>
              <Badge
                variant="outline"
                className={`mt-1 ${statusColors[partner.status] ?? ""}`}
              >
                {statusLabel}
              </Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Region</div>
              <div className="font-medium">{partner.region}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">
                Commission rate
              </div>
              <div className="font-medium text-success">
                {partner.commissionPercent}%
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Member since</div>
              <div className="font-medium">
                {new Date(partner.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <ChangePasswordCard />
    </div>
  );
}
