"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { passwordSchema } from "@skillstream/shared";
import { authApi } from "@/lib/api/auth";
import { getApiErrorMessage } from "@/lib/api/errors";
import { PasswordRequirements } from "@/components/shared/password-requirements";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

export function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordMutation = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  function handlePasswordSave() {
    if (!currentPassword) {
      toast.error("Enter your current password");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (currentPassword === newPassword) {
      toast.error("New password must be different from your current password");
      return;
    }

    const result = passwordSchema.safeParse(newPassword);
    if (!result.success) {
      toast.error(
        result.error.issues[0]?.message ??
          "Password does not meet the requirements",
      );
      return;
    }

    passwordMutation.mutate();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LockKeyhole className="h-4 w-4 text-primary" /> Change password
        </CardTitle>
        <CardDescription>
          Verify your current password before setting a new one.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="change-password-current">Current password</Label>
            <PasswordInput
              id="change-password-current"
              value={currentPassword}
              visible={showCurrentPassword}
              onChange={setCurrentPassword}
              onToggle={() => setShowCurrentPassword((value) => !value)}
              label={
                showCurrentPassword
                  ? "Hide current password"
                  : "Show current password"
              }
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="change-password-new">New password</Label>
            <PasswordInput
              id="change-password-new"
              value={newPassword}
              visible={showNewPassword}
              onChange={setNewPassword}
              onToggle={() => setShowNewPassword((value) => !value)}
              label={
                showNewPassword ? "Hide new password" : "Show new password"
              }
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="change-password-confirm">
              Confirm new password
            </Label>
            <PasswordInput
              id="change-password-confirm"
              value={confirmPassword}
              visible={showConfirmPassword}
              onChange={setConfirmPassword}
              onToggle={() => setShowConfirmPassword((value) => !value)}
              label={
                showConfirmPassword
                  ? "Hide confirmation password"
                  : "Show confirmation password"
              }
              autoComplete="new-password"
            />
          </div>
        </div>
        <PasswordRequirements value={newPassword} />
        <Button
          onClick={handlePasswordSave}
          disabled={passwordMutation.isPending}
        >
          {passwordMutation.isPending ? "Updating…" : "Update password"}
        </Button>
      </CardContent>
    </Card>
  );
}

function PasswordInput({
  id,
  value,
  visible,
  onChange,
  onToggle,
  label,
  autoComplete,
}: {
  id: string;
  value: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
  label: string;
  autoComplete: "current-password" | "new-password";
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        className="pr-10"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-0 top-0 h-8 w-9 text-muted-foreground hover:text-foreground"
        aria-label={label}
        aria-pressed={visible}
        aria-controls={id}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onToggle}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );
}
