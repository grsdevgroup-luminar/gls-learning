"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2, HelpCircle } from "lucide-react";

// Client-only editing state for the course-authoring quiz builder — not a
// wire DTO. The API's own quiz-authoring contracts are all one-shot request
// bodies (CreateQuizQuestionInput etc.), so there's nothing to reuse for "the
// whole quiz as one editable in-memory tree", which is what this UI needs.
export interface BuilderQuizOption {
  id: string;
  text: string;
}
export interface BuilderQuizQuestion {
  id: string;
  prompt: string;
  options: BuilderQuizOption[];
  correctOptionId: string;
  explanation?: string;
}
export interface BuilderQuiz {
  passScore: number;
  questions: BuilderQuizQuestion[];
}

let qid = 5000;
const nextQid = () => `qa${qid++}`;

function emptyQuestion(): BuilderQuizQuestion {
  const base = nextQid();
  return {
    id: base,
    prompt: "",
    options: [0, 1, 2, 3].map((i) => ({ id: `${base}o${i}`, text: "" })),
    correctOptionId: `${base}o0`,
  };
}

export function emptyQuiz(): BuilderQuiz {
  return { passScore: 70, questions: [emptyQuestion()] };
}

export function QuizEditor({
  quiz,
  onChange,
}: {
  quiz: BuilderQuiz;
  onChange: (next: BuilderQuiz) => void;
}) {
  function patchQuestion(qid: string, p: Partial<BuilderQuizQuestion>) {
    onChange({
      ...quiz,
      questions: quiz.questions.map((q) => (q.id === qid ? { ...q, ...p } : q)),
    });
  }
  function patchOption(qId: string, oId: string, text: string) {
    onChange({
      ...quiz,
      questions: quiz.questions.map((q) =>
        q.id === qId ? { ...q, options: q.options.map((o) => (o.id === oId ? { ...o, text } : o)) } : q,
      ),
    });
  }
  function addQuestion() {
    onChange({ ...quiz, questions: [...quiz.questions, emptyQuestion()] });
  }
  function removeQuestion(qId: string) {
    onChange({ ...quiz, questions: quiz.questions.filter((q) => q.id !== qId) });
  }

  return (
    <div className="space-y-4 rounded-lg border bg-muted/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <HelpCircle className="h-3.5 w-3.5 text-primary" /> Quiz questions
        </div>
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground">Pass score</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={quiz.passScore}
            onChange={(e) => onChange({ ...quiz, passScore: Number(e.target.value) || 0 })}
            className="h-7 w-16"
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      </div>

      {quiz.questions.map((q, qi) => (
        <div key={q.id} className="rounded-md border bg-card p-3">
          <div className="flex items-center gap-2">
            <Input
              value={q.prompt}
              onChange={(e) => patchQuestion(q.id, { prompt: e.target.value })}
              placeholder={`Question ${qi + 1}`}
              className="h-8"
            />
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => removeQuestion(q.id)}
              aria-label="Remove question"
              disabled={quiz.questions.length <= 1}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>

          <RadioGroup
            className="mt-2"
            value={q.correctOptionId}
            onValueChange={(v) => patchQuestion(q.id, { correctOptionId: v as string })}
          >
            {q.options.map((o, oi) => (
              <div key={o.id} className="flex items-center gap-2">
                <RadioGroupItem value={o.id} aria-label={`Mark option ${oi + 1} correct`} />
                <Input
                  value={o.text}
                  onChange={(e) => patchOption(q.id, o.id, e.target.value)}
                  placeholder={`Option ${oi + 1}`}
                  className="h-7 flex-1 text-sm"
                />
              </div>
            ))}
          </RadioGroup>
          <p className="mt-1.5 text-xs text-muted-foreground">Select the radio next to the correct option.</p>
        </div>
      ))}

      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={addQuestion}>
        <Plus /> Add question
      </Button>
    </div>
  );
}
