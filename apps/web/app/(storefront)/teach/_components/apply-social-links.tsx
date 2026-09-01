import { Stagger } from "@/components/shared/motion";
import { FormField } from "@/components/shared/form-field";
import { Input } from "@/components/ui/input";

export type SocialLinkField = "linkedinUrl" | "twitterUrl" | "youtubeUrl" | "facebookUrl" | "otherUrl";

export function ApplySocialLinks({
  values,
  errors,
  onChange,
}: {
  values: Record<SocialLinkField, string>;
  errors: Partial<Record<SocialLinkField, string>>;
  onChange: (field: SocialLinkField, value: string) => void;
}) {
  return (
    <div className="space-y-4 border-t border-border pt-6">
      <div>
        <h3 className="text-sm font-semibold">Social &amp; portfolio links</h3>
        <p className="text-xs text-muted-foreground">Optional — help learners and reviewers find you elsewhere.</p>
      </div>
      <Stagger className="space-y-4" gap={0.05}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="LinkedIn" error={errors.linkedinUrl}>
            <Input
              value={values.linkedinUrl}
              onChange={(e) => onChange("linkedinUrl", e.target.value)}
              placeholder="https://linkedin.com/in/username"
              aria-invalid={!!errors.linkedinUrl}
            />
          </FormField>
          <FormField label="Twitter / X" error={errors.twitterUrl}>
            <Input
              value={values.twitterUrl}
              onChange={(e) => onChange("twitterUrl", e.target.value)}
              placeholder="https://x.com/username"
              aria-invalid={!!errors.twitterUrl}
            />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="YouTube" error={errors.youtubeUrl}>
            <Input
              value={values.youtubeUrl}
              onChange={(e) => onChange("youtubeUrl", e.target.value)}
              placeholder="https://youtube.com/@username"
              aria-invalid={!!errors.youtubeUrl}
            />
          </FormField>
          <FormField label="Facebook" error={errors.facebookUrl}>
            <Input
              value={values.facebookUrl}
              onChange={(e) => onChange("facebookUrl", e.target.value)}
              placeholder="https://facebook.com/username"
              aria-invalid={!!errors.facebookUrl}
            />
          </FormField>
        </div>
        <FormField label="Another link of your choice" hint="optional" error={errors.otherUrl}>
          <Input
            value={values.otherUrl}
            onChange={(e) => onChange("otherUrl", e.target.value)}
            placeholder="https://yourwebsite.com"
            aria-invalid={!!errors.otherUrl}
          />
        </FormField>
      </Stagger>
    </div>
  );
}
