"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, HelpCircle } from "lucide-react";

export interface BuilderQuizOption { id: string; text: string; }
export interface BuilderQuizQuestion {
  id: string;
  questionType: "MCQ" | "WRITTEN";
  marks: number;
  wordLimitMin?: number;
  wordLimitMax?: number;
  modelAnswer?: string;
  gradingRubric?: string;
  prompt: string;
  options: BuilderQuizOption[];
  correctOptionIds: string[];
  multipleAnswers: boolean;
  explanation?: string;
}
export interface BuilderQuizGroup {
  id: string;
  label: string;
  title: string;
  scenario: string;
  marks?: number;
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
  return {
    id: base,
    questionType: "MCQ",
    marks: 1,
    prompt: "",
    options: [0, 1].map((i) => ({ id: `${base}o${i}`, text: "" })),
    correctOptionIds: [`${base}o0`],
    multipleAnswers: false,
  };
}

export function emptyQuiz(): BuilderQuiz {
  return { passScore: 70, minutesPerQuestion: 1, groups: [{ id: nextId("g"), label: "", title: "", scenario: "", questions: [emptyQuestion()] }] };
}

export function flattenQuizQuestions(quiz: BuilderQuiz) {
  return quiz.groups.flatMap((group, groupOrder) => group.questions.map((question) => ({
    question,
    scenario: group.scenario.trim(),
    groupLabel: group.label.trim(),
    groupTitle: group.title.trim(),
    groupScenario: group.scenario.trim(),
    groupMarks: group.marks,
    groupOrder,
  })));
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
  function setAnswerMode(groupId: string, questionId: string, multipleAnswers: boolean) {
    onChange({
      ...quiz,
      groups: quiz.groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              questions: g.questions.map((q) =>
                q.id === questionId
                  ? {
                      ...q,
                      multipleAnswers,
                      correctOptionIds: q.correctOptionIds.slice(0, 1),
                    }
                  : q,
              ),
            }
          : g,
      ),
    });
  }
  function setCorrectOption(groupId: string, questionId: string, optionId: string, checked: boolean, multipleAnswers: boolean) {
    onChange({
      ...quiz,
      groups: quiz.groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              questions: g.questions.map((q) => {
                if (q.id !== questionId) return q;
                const next = multipleAnswers
                  ? checked
                    ? [...new Set([...q.correctOptionIds, optionId])]
                    : q.correctOptionIds.filter((id) => id !== optionId)
                  : [optionId];
                return { ...q, correctOptionIds: next };
              }),
            }
          : g,
      ),
    });
  }
  function addQuestion(groupId: string) {
    onChange({ ...quiz, groups: quiz.groups.map((g) => g.id === groupId ? { ...g, questions: [...g.questions, emptyQuestion()] } : g) });
  }
  function insertQuestionAfter(groupId: string, questionId: string) {
    onChange({ ...quiz, groups: quiz.groups.map((group) => {
      if (group.id !== groupId) return group;
      const index = group.questions.findIndex((question) => question.id === questionId);
      if (index < 0) return group;
      const questions = [...group.questions];
      questions.splice(index + 1, 0, emptyQuestion());
      return { ...group, questions };
    }) });
  }
  function newSectionLabel() {
    const labels = new Set(quiz.groups.map((group) => group.label.trim()));
    let label = "New section";
    let suffix = 2;
    while (labels.has(label)) label = `New section ${suffix++}`;
    return label;
  }
  function insertSectionAfter(groupId: string, questionId: string) {
    const groupIndex = quiz.groups.findIndex((group) => group.id === groupId);
    if (groupIndex < 0) return;
    const group = quiz.groups[groupIndex];
    const questionIndex = group.questions.findIndex((question) => question.id === questionId);
    if (questionIndex < 0) return;
    const nextGroup: BuilderQuizGroup = {
      id: nextId("g"), label: newSectionLabel(), title: "", scenario: "",
      questions: group.questions.slice(questionIndex + 1),
    };
    if (nextGroup.questions.length === 0) nextGroup.questions = [emptyQuestion()];
    const groups = [...quiz.groups];
    groups.splice(groupIndex, 1, { ...group, questions: group.questions.slice(0, questionIndex + 1) }, nextGroup);
    onChange({ ...quiz, groups });
  }
  function addScenarioGroup() {
    onChange({ ...quiz, groups: [...quiz.groups, { id: nextId("g"), label: newSectionLabel(), title: "", scenario: "", questions: [emptyQuestion()] }] });
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
      return {
        ...q,
        options,
        correctOptionIds: q.correctOptionIds.includes(optionId)
          ? [options[0].id]
          : q.correctOptionIds,
      };
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
          <div className="mb-3 flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label.trim() || (group.scenario.trim() ? "Scenario" : "Questions")}</p>{quiz.groups.length > 1 && <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...quiz, groups: quiz.groups.filter((g) => g.id !== group.id) })}><Trash2 /> Remove group</Button>}</div>
          <div className="mb-3 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_7rem]">
            <Input value={group.label} onChange={(e) => patchGroup(group.id, { label: e.target.value })} placeholder="Optional section / subsection (e.g. 4.1)" aria-label={`Section label for group ${groupIndex + 1}`} />
            <Input value={group.title} onChange={(e) => patchGroup(group.id, { title: e.target.value })} placeholder="Optional section title" aria-label={`Section title for group ${groupIndex + 1}`} />
            <Input type="number" min={0} value={group.marks ?? ""} onChange={(e) => patchGroup(group.id, { marks: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) })} placeholder="Marks" aria-label={`Marks for group ${groupIndex + 1}`} />
          </div>
          <Textarea value={group.scenario} onChange={(e) => patchGroup(group.id, { scenario: e.target.value })} placeholder="Optional instructions, scenario, or case study for these questions" aria-label={`Instructions for group ${groupIndex + 1}`} className="mb-3 min-h-20 resize-y text-sm" />
          <div className="space-y-4">
            {group.questions.map((q) => (
              <div key={q.id} className="rounded-md border bg-background p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><Input value={q.prompt} onChange={(e) => patchQuestion(group.id, q.id, { prompt: e.target.value })} placeholder="Question text" className="h-8 min-w-0 flex-1" /><select value={q.questionType} onChange={(e) => patchQuestion(group.id, q.id, { questionType: e.target.value as "MCQ" | "WRITTEN" })} className="h-8 rounded-md border bg-background px-2 text-xs sm:w-36"><option value="MCQ">Multiple choice</option><option value="WRITTEN">Written answer</option></select><Button type="button" size="icon-sm" variant="ghost" aria-label="Remove question" disabled={totalQuestions <= 1} onClick={() => removeQuestion(group.id, q.id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button></div>
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-muted/30 px-2 py-1.5"><Label className="text-xs text-muted-foreground">Marks</Label><Input type="number" min={1} value={q.marks} onChange={(e) => patchQuestion(group.id, q.id, { marks: Math.max(1, Number(e.target.value) || 1) })} className="h-7 w-16" />{q.questionType === "MCQ" && <><Label htmlFor={`multiple-${q.id}`} className="ml-auto text-xs text-muted-foreground">Allow multiple answers</Label><Switch id={`multiple-${q.id}`} checked={q.multipleAnswers} onCheckedChange={(checked) => setAnswerMode(group.id, q.id, checked)} /></>}</div>
                {q.questionType === "WRITTEN" ? (
                  <div className="mt-2 space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2"><Input type="number" min={0} value={q.wordLimitMin ?? ""} onChange={(e) => patchQuestion(group.id, q.id, { wordLimitMin: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="Minimum words (optional)" /><Input type="number" min={1} value={q.wordLimitMax ?? ""} onChange={(e) => patchQuestion(group.id, q.id, { wordLimitMax: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="Maximum words (optional)" /></div>
                    <Textarea value={q.gradingRubric ?? ""} onChange={(e) => patchQuestion(group.id, q.id, { gradingRubric: e.target.value })} placeholder="Optional grading rubric for the instructor" className="min-h-16 text-sm" />
                  </div>
                ) : <div className="mt-2 space-y-2">
                  {q.options.map((o, optionIndex) => <div key={o.id} className="flex min-w-0 items-center gap-2">
                    {q.multipleAnswers ? (
                      <input type="checkbox" checked={q.correctOptionIds.includes(o.id)} onChange={(e) => setCorrectOption(group.id, q.id, o.id, e.target.checked, true)} aria-label={`Mark option ${optionIndex + 1} correct`} className="size-4 shrink-0 accent-primary" />
                    ) : (
                      <input type="radio" name={`correct-${q.id}`} checked={q.correctOptionIds[0] === o.id} onChange={() => setCorrectOption(group.id, q.id, o.id, true, false)} aria-label={`Mark option ${optionIndex + 1} correct`} className="size-4 shrink-0 accent-primary" />
                    )}
                    <Input value={o.text} onChange={(e) => patchOption(group.id, q.id, o.id, e.target.value)} placeholder={`Option ${optionIndex + 1}`} className="h-7 min-w-0 flex-1 text-sm" /><Button type="button" size="icon-xs" variant="ghost" aria-label={`Remove option ${optionIndex + 1}`} disabled={q.options.length <= MIN_OPTIONS} onClick={() => removeOption(group.id, q.id, o.id)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                  </div>)}
                </div>}
                {q.questionType === "MCQ" && <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{q.multipleAnswers ? "Select all correct options." : "Select the correct option."}</p><Button type="button" size="sm" variant="outline" disabled={q.options.length >= MAX_OPTIONS} onClick={() => addOption(group.id, q.id)}><Plus /> Add option</Button></div>}
                <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                  <Button type="button" size="sm" variant="ghost" onClick={() => insertQuestionAfter(group.id, q.id)}><Plus /> Add question below</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => insertSectionAfter(group.id, q.id)}><Plus /> Add section / subsection below</Button>
                </div>
              </div>
            ))}
          </div>
          <Button type="button" size="sm" variant="ghost" className="mt-3 text-muted-foreground" onClick={() => addQuestion(group.id)}><Plus /> Add question to this group</Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={addScenarioGroup}><Plus /> Add section / subsection</Button>
    </div>
  );
}
