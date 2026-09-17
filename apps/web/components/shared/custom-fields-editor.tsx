"use client";

import type { PartnerCustomField } from "@skillstream/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";

/** Applicant-defined label/value rows — e.g. "Company" → "Acme Inc". Fully
 *  controlled; the caller owns the array and persists it however it likes. */
export function CustomFieldsEditor({
  value,
  onChange,
  max = 10,
}: {
  value: PartnerCustomField[];
  onChange: (next: PartnerCustomField[]) => void;
  max?: number;
}) {
  function update(index: number, field: keyof PartnerCustomField, text: string) {
    onChange(value.map((row, i) => (i === index ? { ...row, [field]: text } : row)));
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function add() {
    onChange([...value, { label: "", value: "" }]);
  }

  return (
    <div className="space-y-2">
      {value.map((row, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={row.label}
            onChange={(e) => update(i, "label", e.target.value)}
            placeholder="Field name, e.g. Company"
            maxLength={60}
            className="flex-1"
          />
          <Input
            value={row.value}
            onChange={(e) => update(i, "value", e.target.value)}
            placeholder="Value"
            maxLength={500}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label="Remove field"
            onClick={() => remove(i)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {value.length < max && (
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4" /> Add field
        </Button>
      )}
    </div>
  );
}
