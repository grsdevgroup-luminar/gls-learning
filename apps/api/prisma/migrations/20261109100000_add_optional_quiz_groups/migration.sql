-- Optional quiz structure for section/subsection labels and shared scenarios.
CREATE TABLE "QuizGroup" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "title" TEXT,
    "scenario" TEXT,
    "marks" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "QuizGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuizGroup_quizId_label_key" ON "QuizGroup"("quizId", "label");
CREATE INDEX "QuizGroup_quizId_order_idx" ON "QuizGroup"("quizId", "order");

ALTER TABLE "QuizGroup" ADD CONSTRAINT "QuizGroup_quizId_fkey"
  FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuizQuestion" ADD COLUMN "groupId" TEXT;
CREATE INDEX "QuizQuestion_groupId_idx" ON "QuizQuestion"("groupId");
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "QuizGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
