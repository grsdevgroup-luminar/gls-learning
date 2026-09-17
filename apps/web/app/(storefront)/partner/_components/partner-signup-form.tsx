"use client";

import { useState } from "react";
import { useRegisterDeliveryPartner } from "@/lib/api/session";
import { api } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { DeliveryPartnerSignupSchema, type PartnerCustomField } from "@skillstream/shared";
import { Reveal, Stagger } from "@/components/shared/motion";
import { FormField } from "@/components/shared/form-field";
import { CountryField } from "@/components/shared/country-field";
import { CustomFieldsEditor } from "@/components/shared/custom-fields-editor";
import { StagedDocumentPicker, type StagedDocument } from "@/components/shared/staged-document-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

type FieldErrors = Partial<Record<"name" | "email" | "password" | "country", string>>;

/** The dedicated delivery-partner journey: creates the account and submits
 *  the application — including any attached documents — in a single step,
 *  so applying never requires first creating (or logging into) a separate
 *  student account. */
export function PartnerSignupForm() {
  const registerDeliveryPartner = useRegisterDeliveryPartner();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [country, setCountry] = useState("");
  const [customFields, setCustomFields] = useState<PartnerCustomField[]>([]);
  const [documents, setDocuments] = useState<StagedDocument[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function clearError(field: keyof FieldErrors) {
    setFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = DeliveryPartnerSignupSchema.safeParse({
      name: name.trim(),
      email: email.trim(),
      password,
      country,
      customFields: customFields.filter((f) => f.label.trim() && f.value.trim()),
    });
    if (!result.success) {
      const errors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setSubmitting(true);
    try {
      await registerDeliveryPartner.mutateAsync(result.data);
      const failed: string[] = [];
      for (const doc of documents) {
        try {
          await api.uploadPartnerDocument(doc.title, doc.file);
        } catch {
          failed.push(doc.title);
        }
      }
      if (failed.length) {
        toast.warning(`Application submitted, but ${failed.length} document(s) failed to upload`, {
          description: "You can retry from your status page.",
        });
      } else {
        toast.success("Application submitted! 🎉", { description: "We'll review it within 1–2 business days." });
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Reveal y={20}>
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="text-xl">Create your delivery partner account</CardTitle>
          <p className="text-sm text-muted-foreground">One step: your account and your application. Approved partners can start referring immediately.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} noValidate className="space-y-6">
            <Stagger className="space-y-4" gap={0.05}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Full name" error={fieldErrors.name}>
                  <Input
                    value={name}
                    onChange={(e) => { setName(e.target.value); clearError("name"); }}
                    placeholder="Alex Morgan"
                    aria-invalid={!!fieldErrors.name}
                  />
                </FormField>
                <FormField label="Email" error={fieldErrors.email}>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value.toLowerCase()); clearError("email"); }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    aria-invalid={!!fieldErrors.email}
                  />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Password" error={fieldErrors.password}>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password (min 8 chars)"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); clearError("password"); }}
                      aria-invalid={!!fieldErrors.password}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-8 w-9 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </FormField>
                <FormField label="Country" error={fieldErrors.country}>
                  <CountryField
                    value={country}
                    onChange={(code) => { setCountry(code); clearError("country"); }}
                  />
                </FormField>
              </div>
              <FormField label="Anything else you'd like us to know? (optional)" hint={`${customFields.length}/10`}>
                <CustomFieldsEditor value={customFields} onChange={setCustomFields} />
              </FormField>
              <FormField label="Supporting documents (optional)" hint={`${documents.length}/5`}>
                <StagedDocumentPicker items={documents} onChange={setDocuments} />
              </FormField>
            </Stagger>

            <Button type="submit" size="lg" className="sheen w-full" disabled={submitting}>
              {submitting ? "Submitting…" : <>Create account &amp; apply <ArrowRight /></>}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              By continuing you agree to our Terms &amp; Privacy Policy.
            </p>
          </form>
        </CardContent>
      </Card>
    </Reveal>
  );
}
