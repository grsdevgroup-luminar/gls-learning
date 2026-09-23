"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useSession, SESSION_QUERY_KEY } from "@/lib/api/session";
import { isIsoCountryCode, isValidPhone } from "@skillstream/shared";
import { Reveal, Stagger } from "@/components/shared/motion";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CountrySelect } from "@/components/shared/country-select";
import { PhoneInput } from "@/components/shared/phone-input";
import { toast } from "sonner";

// Contact (country/phone) lives on the User record, not the instructor
// profile, so it's saved through the same generic endpoint the student
// Account page uses. Fully self-contained: no state here affects any other
// card on this page.
export function ContactCard() {
  const qc = useQueryClient();
  const { user } = useSession();

  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [prevUser, setPrevUser] = useState<typeof user>();
  if (user && user !== prevUser) {
    setPrevUser(user);
    setCountry(user.country && isIsoCountryCode(user.country) ? user.country : "");
    setPhone(user.phone ?? "");
  }

  const contactMutation = useMutation({
    mutationFn: () =>
      apiFetch<void>("/auth/me/profile", {
        method: "PATCH",
        body: { country: country || null, phone: phone.trim() || null },
      }),
    onSuccess: () => {
      toast.success("Contact info saved");
      void qc.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  function handleContactSave() {
    if (!phone.trim()) {
      toast.error("Please enter your phone number.");
      return;
    }
    if (!country) {
      toast.error("Please select your country so we can validate your phone number.");
      return;
    }
    if (!isValidPhone(phone.trim())) {
      toast.error("Please enter a valid phone number for the selected country.");
      return;
    }
    contactMutation.mutate();
  }

  return (
    <Reveal y={20} delay={0.09}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact</CardTitle>
          <CardDescription>Used for account security and SMS reminders — not shown publicly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Stagger className="grid gap-4 sm:grid-cols-2" gap={0.05}>
            <FormField label="Country" hint="Sets your phone's calling code">
              <CountrySelect value={country} onChange={setCountry} />
            </FormField>
            <FormField label="Phone" hint="For SMS reminders">
              <PhoneInput country={country} value={phone} onChange={setPhone} />
            </FormField>
          </Stagger>
          <Button
            variant="outline"
            disabled={contactMutation.isPending}
            onClick={handleContactSave}
          >
            {contactMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </CardContent>
      </Card>
    </Reveal>
  );
}
