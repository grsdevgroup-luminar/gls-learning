"use client";

import { Reveal, Stagger } from "@/components/shared/motion";
import { FormField } from "@/components/shared/form-field";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type LinkField = "sampleUrl" | "linkedinUrl" | "twitterUrl" | "youtubeUrl" | "facebookUrl" | "otherUrl";

const LINK_FIELDS: Array<{ field: LinkField; label: string; placeholder: string }> = [
  { field: "linkedinUrl", label: "LinkedIn", placeholder: "https://linkedin.com/in/username" },
  { field: "twitterUrl", label: "Twitter / X", placeholder: "https://x.com/username" },
  { field: "youtubeUrl", label: "YouTube", placeholder: "https://youtube.com/@username" },
  { field: "facebookUrl", label: "Facebook", placeholder: "https://facebook.com/username" },
  { field: "sampleUrl", label: "Portfolio / teaching sample", placeholder: "https://…" },
  { field: "otherUrl", label: "Another link of your choice", placeholder: "https://yourwebsite.com" },
];

export function SocialLinksCard({
  values,
  errors,
  onChange,
}: {
  values: Record<LinkField, string>;
  errors: Partial<Record<LinkField, string>>;
  onChange: (field: LinkField, value: string) => void;
}) {
  return (
    <Reveal y={20} delay={0.12}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Social &amp; portfolio links</CardTitle>
          <p className="text-sm text-muted-foreground">Shown on your public instructor page. Leave any field blank to hide it.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Stagger className="space-y-4" gap={0.05}>
            {[0, 2, 4].map((i) => (
              <div key={i} className="grid gap-4 sm:grid-cols-2">
                {LINK_FIELDS.slice(i, i + 2).map(({ field, label, placeholder }) => (
                  <FormField key={field} label={label} error={errors[field]}>
                    <Input
                      value={values[field]}
                      onChange={(e) => onChange(field, e.target.value)}
                      placeholder={placeholder}
                      aria-invalid={!!errors[field]}
                    />
                  </FormField>
                ))}
              </div>
            ))}
          </Stagger>
        </CardContent>
      </Card>
    </Reveal>
  );
}
