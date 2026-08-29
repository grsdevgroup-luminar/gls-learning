"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CategoryDto } from "@skillstream/shared";
import { Check, ChevronDown, LoaderCircle, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/query-keys";
import { useCategories, useProposeCategory } from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface CategoryPickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  canManage?: boolean;
}

export function CategoryPicker({ value, onChange, disabled, canManage = false }: CategoryPickerProps) {
  const qc = useQueryClient();
  const { data: publicCategories = [], isLoading: publicLoading } = useCategories();
  const { data: managedCategories = [], isLoading: managedLoading } = useQuery({
    queryKey: qk.adminCategories,
    queryFn: adminApi.categories,
    enabled: canManage,
  });
  const propose = useProposeCategory();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const categories = canManage
    ? managedCategories.filter((category) => category.status === "ACTIVE").map((category) => category.name)
    : publicCategories;
  const isLoading = canManage ? managedLoading : publicLoading;

  function refreshCategories() {
    void qc.invalidateQueries({ queryKey: qk.adminCategories });
    void qc.invalidateQueries({ queryKey: qk.categories });
  }

  const adminCreate = useMutation({
    mutationFn: (name: string) => adminApi.createCategory(name),
    onSuccess: () => {
      refreshCategories();
      setQuery("");
      toast.success("Category added");
    },
    onError: () => toast.error("Could not add this category"),
  });
  const adminUpdate = useMutation({
    mutationFn: ({ id, name, status }: { id: string; name?: string; status?: CategoryDto["status"]; previousName?: string }) =>
      adminApi.updateCategory(id, { name, status }),
    onSuccess: (category, variables) => {
      refreshCategories();
      if (variables.previousName === value) {
        onChange(category.name);
      }
      setEditingId(null);
      toast.success("Category updated");
    },
    onError: () => toast.error("Could not update this category"),
  });
  const adminRemove = useMutation({
    mutationFn: (id: string) => adminApi.deleteCategory(id),
    onSuccess: (result, id) => {
      refreshCategories();
      if (managedCategories.some((category) => category.id === id && category.name === value)) {
        onChange("");
      }
      toast.success(result.archived ? "Category removed from selection" : "Category deleted");
    },
    onError: () => toast.error("Could not remove this category"),
  });

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return categories.filter((category) =>
      category.toLocaleLowerCase().includes(normalized),
    );
  }, [categories, query]);
  const filteredManaged = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return managedCategories.filter((category) => category.name.toLocaleLowerCase().includes(normalized));
  }, [managedCategories, query]);

  const exactMatch = (canManage ? managedCategories.map((category) => category.name) : publicCategories).some(
    (category) => category.toLocaleLowerCase() === query.trim().toLocaleLowerCase(),
  );

  async function addCategory() {
    const name = query.trim();
    if (!name || exactMatch || propose.isPending) return;

    try {
      if (canManage) {
        await adminCreate.mutateAsync(name);
        return;
      }
      const category = await propose.mutateAsync(name);
      onChange(category.name);
      setOpen(false);
      setQuery("");
      toast.success(
        category.status === "ACTIVE" ? "Category added" : "Category sent for admin review",
        { description: category.name },
      );
    } catch {
      toast.error("Could not add this category");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={<Button variant="outline" className="w-full justify-between font-normal" />}
      >
        <span className={value ? "truncate" : "text-muted-foreground"}>
          {value || "Select a category"}
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--anchor-width)] min-w-72 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search categories"
            className="pl-8"
          />
        </div>
        <div className="mt-1 max-h-56 overflow-y-auto">
          {isLoading ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">Loading categories...</p>
          ) : (canManage ? filteredManaged.length > 0 : filtered.length > 0) ? (
            canManage ? filteredManaged.map((category) => (
              <div key={category.id} className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-accent">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center justify-between py-1 text-left text-sm"
                  disabled={category.status !== "ACTIVE"}
                  onClick={() => {
                    onChange(category.name);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="truncate">{category.name} <span className="text-xs text-muted-foreground">({category.status.toLowerCase()})</span></span>
                  {category.name === value && <Check className="size-4 shrink-0 text-primary" />}
                </button>
                {editingId === category.id ? (
                  <>
                    <Input value={editingName} onChange={(event) => setEditingName(event.target.value)} className="h-7 min-w-0 flex-1" />
                    <Button size="icon-sm" disabled={!editingName.trim() || adminUpdate.isPending} onClick={() => void adminUpdate.mutateAsync({ id: category.id, name: editingName.trim(), previousName: category.name })} aria-label="Save category"><Check /></Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => setEditingId(null)} aria-label="Cancel edit"><X /></Button>
                  </>
                ) : (
                  <>
                    {category.status === "PENDING" && <Button size="icon-sm" onClick={() => void adminUpdate.mutateAsync({ id: category.id, status: "ACTIVE" })} aria-label={`Approve ${category.name}`}><Check /></Button>}
                    <Button size="icon-sm" variant="ghost" onClick={() => { setEditingId(category.id); setEditingName(category.name); }} aria-label={`Edit ${category.name}`}><Pencil /></Button>
                    <ConfirmDialog
                      trigger={<Button size="icon-sm" variant="ghost" className="text-destructive" aria-label={`Remove ${category.name}`}><Trash2 /></Button>}
                      title={`Remove ${category.name}?`}
                      description="This category will no longer be available for course selection."
                      pending={adminRemove.isPending}
                      onConfirm={async () => { await adminRemove.mutateAsync(category.id); }}
                    />
                  </>
                )}
              </div>
            )) : filtered.map((category) => (
              <button
                key={category}
                type="button"
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onChange(category);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {category}
                {category === value && <Check className="size-4 text-primary" />}
              </button>
            ))
          ) : (
            <p className="px-2 py-3 text-sm text-muted-foreground">No matching categories.</p>
          )}
        </div>
        {query.trim() && !exactMatch && (
          <Button
            type="button"
            variant="secondary"
            className="mt-1 w-full justify-start"
            disabled={propose.isPending || adminCreate.isPending}
            onClick={() => void addCategory()}
          >
            {propose.isPending ? <LoaderCircle className="animate-spin" /> : <Plus />}
            {canManage ? `Add "${query.trim()}"` : `Add "${query.trim()}" for review`}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
