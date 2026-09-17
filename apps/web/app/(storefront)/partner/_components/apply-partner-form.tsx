"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/endpoints";
import { getApiErrorMessage } from "@/lib/api/errors";
import { ApplyDeliveryPartnerSchema, type PartnerCustomField } from "@skillstream/shared";
import { Reveal, Stagger } from "@/components/shared/motion";
import { FormField } from "@/components/shared/form-field";
import { CountryField } from "@/components/shared/country-field";
import { CustomFieldsEditor } from "@/components/shared/custom-fields-editor";
import { StagedDocumentPicker, type StagedDocument } from "@/components/shared/staged-document-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

/** Applies onto the caller's existing account — used when already logged in
 *  (a student applying, or someone re-applying after a rejection). */
export function ApplyPartnerForm() {
  const qc = useQueryClient();
  const [country, setCountry] = useState("");
  const [customFields, setCustomFields] = useState<PartnerCustomField[]>([]);
  const [documents, setDocuments] = useState<StagedDocument[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [countryError, setCountryError] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = ApplyDeliveryPartnerSchema.safeParse({
      country,
      customFields: customFields.filter((f) => f.label.trim() && f.value.trim()),
    });
    if (!result.success) {
      const countryIssue = result.error.issues.find((i) => i.path[0] === "country");
      setCountryError(countryIssue?.message ?? (country ? undefined : "Country is required"));
      return;
    }
    setCountryError(undefined);

    setSubmitting(true);
    try {
      await api.applyDeliveryPartner(result.data);
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
      await qc.invalidateQueries({ queryKey: ["me", "delivery-partner", "application"] });
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
          <CardTitle className="text-xl">Become a delivery partner</CardTitle>
          <p className="text-sm text-muted-foreground">Refer students with your personal link and earn commission on every sale.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} noValidate className="space-y-6">
            <Stagger className="space-y-4" gap={0.05}>
              <FormField label="Country" error={countryError}>
                <CountryField
                  value={country}
                  onChange={(code) => { setCountry(code); setCountryError(undefined); }}
                />
              </FormField>
              <FormField label="Anything else you'd like us to know? (optional)" hint={`${customFields.length}/10`}>
                <CustomFieldsEditor value={customFields} onChange={setCustomFields} />
              </FormField>
              <FormField label="Supporting documents (optional)" hint={`${documents.length}/5`}>
                <StagedDocumentPicker items={documents} onChange={setDocuments} />
              </FormField>
            </Stagger>

            <Button type="submit" size="lg" className="sheen w-full" disabled={submitting}>
              {submitting ? "Submitting…" : <>Submit application <ArrowRight /></>}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Reveal>
  );
}
