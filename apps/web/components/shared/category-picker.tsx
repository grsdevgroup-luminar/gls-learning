"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CategoryDto } from "@skillstream/shared";
import { Check, ChevronDown, LoaderCircle, Pencil, Plus, Search, Settings2, Trash2, X } from "lucide-react";
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
  const [manageOpen, setManageOpen] = useState(false);
  const [requestedCategory, setRequestedCategory] = useState<CategoryDto | null>(null);

  const categories = canManage
    ? managedCategories.filter((category) => category.status === "ACTIVE").map((category) => category.name)
    : publicCategories;
  const isLoading = canManage ? managedLoading : publicLoading;
  const pendingCount = managedCategories.filter((category) => category.status === "PENDING").length;

  useEffect(() => {
    if (requestedCategory && publicCategories.includes(requestedCategory.name)) {
      onChange(requestedCategory.name);
      setRequestedCategory(null);
    }
  }, [onChange, publicCategories, requestedCategory]);

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
      qc.setQueryData<CategoryDto[]>(qk.adminCategories, (current = []) => current.map((item) => item.id === category.id ? { ...item, ...category } : item));
      if (category.status === "ACTIVE") {
        qc.setQueryData<string[]>(qk.categories, (current = []) => current.includes(category.name) ? current : [...current, category.name].sort());
      }
      refreshCategories();
      if ((variables.status === "ACTIVE" && value === category.name) || variables.previousName === value) {
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
      setRequestedCategory(category.status === "PENDING" ? category : null);
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
          {value || "Select or request a category"}
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--anchor-width)] max-w-[calc(100vw-2rem)] min-w-0 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search approved categories"
            className="search-input border-input bg-background pl-8 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 dark:bg-input/30"
          />
        </div>
        {!canManage && (
          <div className="mb-2 rounded-md bg-primary/5 px-2 py-1.5">
            <p className="text-xs font-medium">Choose an approved category</p>
            <p className="text-[11px] text-muted-foreground">Cannot find yours? Type a new name below to request admin approval.</p>
          </div>
        )}
        {canManage && (
          <Button type="button" variant="ghost" size="sm" className="mt-1 w-full justify-start" onClick={() => setManageOpen((openState) => !openState)}>
            <Settings2 className="size-4" /> {manageOpen ? "Hide category requests" : `Manage requests${pendingCount ? ` (${pendingCount})` : ""}`}
          </Button>
        )}
        {canManage && manageOpen && (
          <div className="mb-2 space-y-2 rounded-md border bg-muted/20 p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Pending requests</span>
              <span className="text-xs text-muted-foreground">{pendingCount}</span>
            </div>
            {pendingCount === 0 ? (
              <p className="text-xs text-muted-foreground">No pending requests.</p>
            ) : managedCategories.filter((category) => category.status === "PENDING").map((category) => (
              <div key={category.id} className="flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{category.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">Requested by {category.requestedBy?.name ?? "Instructor"}{category.requestedBy?.email ? ` - ${category.requestedBy.email}` : ""}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" size="sm" onClick={() => void adminUpdate.mutateAsync({ id: category.id, status: "ACTIVE" })}><Check className="size-3.5" /> Approve</Button>
                  <ConfirmDialog
                    trigger={<Button type="button" size="sm" variant="outline">Reject</Button>}
                    title={`Reject ${category.name}?`}
                    description="This category will remain unavailable for course selection."
                    pending={adminUpdate.isPending}
                    onConfirm={async () => { await adminUpdate.mutateAsync({ id: category.id, status: "REJECTED" }); }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        {(!canManage || !manageOpen) && (
        <div className="mt-1 max-h-56 overflow-y-auto">
          {isLoading ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">Loading categories...</p>
          ) : (canManage ? filteredManaged.filter((category) => category.status === "ACTIVE").length > 0 : filtered.length > 0) ? (
            canManage ? filteredManaged.filter((category) => category.status === "ACTIVE").map((category) => (
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
            <div className="space-y-2 px-2 py-3">
            <p className="text-sm text-muted-foreground">No approved category found.</p>
            <p className="text-xs text-muted-foreground">You can request this category for admin approval.</p>
          </div>
          )}
        </div>
        )}
        {requestedCategory && (
          <p className="mt-2 rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700">
            “{requestedCategory.name}” is pending admin approval. It will become selectable after approval.
          </p>
        )}
        {query.trim() && !exactMatch && (
          <Button
            type="button"
            variant="secondary"
            className="mt-1 w-full justify-start"
            disabled={propose.isPending || adminCreate.isPending}
            onClick={() => void addCategory()}
          >
            {propose.isPending ? <LoaderCircle className="animate-spin" /> : <Plus />}
            {canManage ? `Add approved "${query.trim()}"` : `Request "${query.trim()}" for approval`}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
