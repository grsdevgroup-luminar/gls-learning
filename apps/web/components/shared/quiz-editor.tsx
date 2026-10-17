"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, HelpCircle } from "lucide-react";

export interface BuilderQuizOption { id: string; text: string; }
export interface BuilderQuizQuestion {
  id: string;
  prompt: string;
  options: BuilderQuizOption[];
  correctOptionId: string;
  explanation?: string;
}
export interface BuilderQuizGroup {
  id: string;
  scenario: string;
  questions: BuilderQuizQuestion[];
}
export interface BuilderQuiz {
  passScore: number;
  minutesPerQuestion: number;
  groups: BuilderQuizGroup[];
}

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 8;

let idSeed = 5000;
const nextId = (prefix: string) => `${prefix}${idSeed++}`;

export function emptyQuestion(): BuilderQuizQuestion {
  const base = nextId("q");
  return { id: base, prompt: "", options: [0, 1].map((i) => ({ id: `${base}o${i}`, text: "" })), correctOptionId: `${base}o0` };
}

export function emptyQuiz(): BuilderQuiz {
  return { passScore: 70, minutesPerQuestion: 1, groups: [{ id: nextId("g"), scenario: "", questions: [emptyQuestion()] }] };
}

export function flattenQuizQuestions(quiz: BuilderQuiz) {
  return quiz.groups.flatMap((group) => group.questions.map((question) => ({ question, scenario: group.scenario.trim() })));
}

export function QuizEditor({ quiz, onChange }: { quiz: BuilderQuiz; onChange: (next: BuilderQuiz) => void }) {
  const totalQuestions = quiz.groups.reduce((count, group) => count + group.questions.length, 0);

  function patchGroup(groupId: string, patch: Partial<BuilderQuizGroup>) {
    onChange({ ...quiz, groups: quiz.groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)) });
  }
  function patchQuestion(groupId: string, questionId: string, patch: Partial<BuilderQuizQuestion>) {
    onChange({ ...quiz, groups: quiz.groups.map((g) => g.id === groupId ? { ...g, questions: g.questions.map((q) => q.id === questionId ? { ...q, ...patch } : q) } : g) });
  }
  function patchOption(groupId: string, questionId: string, optionId: string, text: string) {
    onChange({ ...quiz, groups: quiz.groups.map((g) => g.id === groupId ? { ...g, questions: g.questions.map((q) => q.id === questionId ? { ...q, options: q.options.map((o) => o.id === optionId ? { ...o, text } : o) } : q) } : g) });
  }
  function addQuestion(groupId: string) {
    onChange({ ...quiz, groups: quiz.groups.map((g) => g.id === groupId ? { ...g, questions: [...g.questions, emptyQuestion()] } : g) });
  }
  function addScenarioGroup() {
    onChange({ ...quiz, groups: [...quiz.groups, { id: nextId("g"), scenario: "", questions: [emptyQuestion()] }] });
  }
  function removeQuestion(groupId: string, questionId: string) {
    if (totalQuestions <= 1) return;
    onChange({ ...quiz, groups: quiz.groups.flatMap((g) => {
      if (g.id !== groupId) return [g];
      const questions = g.questions.filter((q) => q.id !== questionId);
      return questions.length ? [{ ...g, questions }] : [];
    }) });
  }
  function addOption(groupId: string, questionId: string) {
    onChange({ ...quiz, groups: quiz.groups.map((g) => g.id === groupId ? { ...g, questions: g.questions.map((q) => q.id === questionId && q.options.length < MAX_OPTIONS ? { ...q, options: [...q.options, { id: nextId(`${q.id}o`), text: "" }] } : q) } : g) });
  }
  function removeOption(groupId: string, questionId: string, optionId: string) {
    onChange({ ...quiz, groups: quiz.groups.map((g) => g.id === groupId ? { ...g, questions: g.questions.map((q) => {
      if (q.id !== questionId || q.options.length <= MIN_OPTIONS) return q;
      const options = q.options.filter((o) => o.id !== optionId);
      return { ...q, options, correctOptionId: q.correctOptionId === optionId ? options[0].id : q.correctOptionId };
    }) } : g) });
  }

  return (
    <div className="min-w-0 max-w-full space-y-4 rounded-lg border bg-muted/10 p-3">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium"><HelpCircle className="h-3.5 w-3.5 text-primary" /> Quiz questions</div>
        <div className="flex flex-wrap items-center justify-start gap-3 sm:justify-end">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5"><Label className="text-xs text-muted-foreground">Pass score</Label><Input type="number" min={0} max={100} value={quiz.passScore} onChange={(e) => onChange({ ...quiz, passScore: Number(e.target.value) || 0 })} className="h-7 w-16" /><span className="text-xs text-muted-foreground">%</span></div>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5"><Label className="text-xs text-muted-foreground">Time / question</Label><Input type="number" min={1} value={quiz.minutesPerQuestion} onChange={(e) => onChange({ ...quiz, minutesPerQuestion: Math.max(1, Number(e.target.value) || 1) })} className="h-7 w-16" /><span className="text-xs text-muted-foreground">min · {totalQuestions * quiz.minutesPerQuestion} min total</span></div>
        </div>
      </div>

      {quiz.groups.map((group, groupIndex) => (
        <div key={group.id} className="min-w-0 rounded-md border bg-card p-3">
          <div className="mb-3 flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.scenario.trim() ? `Scenario ${groupIndex + 1}` : `Question group ${groupIndex + 1}`}</p>{quiz.groups.length > 1 && <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...quiz, groups: quiz.groups.filter((g) => g.id !== group.id) })}><Trash2 /> Remove group</Button>}</div>
          <Textarea value={group.scenario} onChange={(e) => patchGroup(group.id, { scenario: e.target.value })} placeholder="Optional scenario or case study for these questions" aria-label={`Scenario for group ${groupIndex + 1}`} className="mb-3 min-h-20 resize-y text-sm" />
          <div className="space-y-4">
            {group.questions.map((q, questionIndex) => (
              <div key={q.id} className="rounded-md border bg-background p-3">
                <div className="flex items-center gap-2"><Input value={q.prompt} onChange={(e) => patchQuestion(group.id, q.id, { prompt: e.target.value })} placeholder={`Question ${questionIndex + 1}`} className="h-8 min-w-0 flex-1" /><Button type="button" size="icon-sm" variant="ghost" aria-label="Remove question" disabled={totalQuestions <= 1} onClick={() => removeQuestion(group.id, q.id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button></div>
                <RadioGroup className="mt-2" value={q.correctOptionId} onValueChange={(v) => patchQuestion(group.id, q.id, { correctOptionId: v as string })}>
                  {q.options.map((o, optionIndex) => <div key={o.id} className="flex min-w-0 items-center gap-2"><RadioGroupItem value={o.id} aria-label={`Mark option ${optionIndex + 1} correct`} /><Input value={o.text} onChange={(e) => patchOption(group.id, q.id, o.id, e.target.value)} placeholder={`Option ${optionIndex + 1}`} className="h-7 min-w-0 flex-1 text-sm" /><Button type="button" size="icon-xs" variant="ghost" aria-label={`Remove option ${optionIndex + 1}`} disabled={q.options.length <= MIN_OPTIONS} onClick={() => removeOption(group.id, q.id, o.id)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button></div>)}
                </RadioGroup>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Select the radio next to the correct option.</p><Button type="button" size="sm" variant="outline" disabled={q.options.length >= MAX_OPTIONS} onClick={() => addOption(group.id, q.id)}><Plus /> Add option</Button></div>
              </div>
            ))}
          </div>
          <Button type="button" size="sm" variant="ghost" className="mt-3 text-muted-foreground" onClick={() => addQuestion(group.id)}><Plus /> Add question to this group</Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={addScenarioGroup}><Plus /> Add scenario group</Button>
    </div>
  );
}
