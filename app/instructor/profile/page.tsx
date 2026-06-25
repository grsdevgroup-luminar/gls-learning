"use client";

import { useState } from "react";
import { useStore } from "@/lib/context/store";
import { categories } from "@/lib/mock/courses";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Reveal, Stagger, Magnetic } from "@/components/shared/motion";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/format";
import { Save, ShieldCheck, Clock } from "lucide-react";
import { toast } from "sonner";

export default function InstructorProfile() {
  const { currentInstructor, updateInstructorProfile, mounted } = useStore();
  const [name, setName] = useState(currentInstructor?.name ?? "");
  const [title, setTitle] = useState(currentInstructor?.title ?? "");
  const [expertise, setExpertise] = useState(currentInstructor?.expertise ?? categories[0]);
  const [bio, setBio] = useState(currentInstructor?.bio ?? "");

  if (!mounted || !currentInstructor) return null;
  const status = currentInstructor.status ?? "approved";

  function save() {
    updateInstructorProfile({ name, title, expertise, bio });
    toast.success("Profile saved");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Instructor profile</h1>
          <p className="text-sm text-muted-foreground">How learners see you across the marketplace.</p>
        </div>
        <Badge
          variant="outline"
          className={status === "approved" ? "gap-1 text-success border-success/30 bg-success/10" : "gap-1 text-warning border-warning/30 bg-warning/10"}
        >
          {status === "approved" ? <ShieldCheck className="size-3" /> : <Clock className="size-3" />}
          {status === "approved" ? "Approved instructor" : status === "pending" ? "Pending approval" : "Not approved"}
        </Badge>
      </header>

      <Reveal y={20}>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <Avatar className="size-16 ring-1 ring-border transition-transform duration-300 hover:scale-105">
              <AvatarFallback className="brand-gradient text-xl text-white">{initials(name || currentInstructor.name)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-heading text-lg font-semibold">{name || "Your name"}</div>
              <div className="text-sm text-muted-foreground">{title || "Your professional headline"}</div>
            </div>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal y={20} delay={0.08}>
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Stagger className="space-y-4" gap={0.05}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Full name">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Morgan" />
                </FormField>
                <FormField label="Email">
                  <Input value={currentInstructor.email ?? ""} readOnly className="opacity-70" />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Headline">
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior Frontend Engineer" />
                </FormField>
                <FormField label="Primary expertise">
                  <Select value={expertise} onValueChange={(v) => v && setExpertise(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              <FormField label="Bio">
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell learners about your background and what you teach…" className="min-h-32" />
              </FormField>
            </Stagger>
            <div className="flex justify-end">
              <Magnetic strength={0.15}>
                <Button className="sheen" onClick={save}><Save /> Save profile</Button>
              </Magnetic>
            </div>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
