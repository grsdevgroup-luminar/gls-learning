# Manual grading for course quizzes and final exams

This guide describes the current grading flow on `tofa19`. A course can contain quiz lessons, including a final exam. Each quiz may contain MCQs, written questions, or both. Manual grading applies **only to written answers**; MCQs are scored automatically. There is no separate overall course grade.

## Who does what

| Role | Action |
| --- | --- |
| Student | Completes every question in an accessible quiz lesson and submits one attempt. |
| Instructor | Reviews written answers for courses they own, provided their instructor profile is approved. |
| Platform admin | Reviews written answers for any course. |

The admin **Reviews** page moderates course ratings and comments. Quiz grading is reached from an individual course instead.

## Set up a quiz

1. Open the course builder and add or edit a **Quiz** lesson. The same editor can be used for a final exam lesson.
2. Add MCQ and/or **Written answer** questions. A quiz can mix the two types in any order.
3. Set the marks for each question and the quiz passing percentage. For MCQs, select the correct option or options. For written questions, enter the prompt; the grading rubric field is optional.
4. Optional question groups, sections, subsections, and scenarios organize the paper but do not alter scoring. A scenario is not required for a written question.
5. Save the course through the normal course builder flow. Written questions do not need MCQ options.

## Student submission

1. The student must be enrolled and allowed to reach the quiz lesson under the course's sequential lesson rules.
2. The student answers every question. A written answer cannot be blank; MCQs need at least one selected option.
3. On submission, each MCQ is scored automatically. For a question with multiple correct options, the selected set must exactly match the correct set to earn that question's marks.
4. If there are **no written questions**, the system calculates the final percentage immediately, checks it against the quiz passing percentage, and marks the lesson complete on a pass.
5. If there is **at least one written question**, the attempt becomes **Pending review**. The initial percentage represents MCQ marks earned divided by *all* possible marks, including the ungraded written marks. It is provisional, does not decide pass/fail, and is not added to the student's best score. The student sees **Submitted for review**, not a failure message.

The quiz page hides the retake action while the latest written submission is pending. The student can return to the lesson to check its status.

## Find submissions and grade written answers

### Instructor

1. Open **Instructor → Courses**.
2. Select **Quiz/Final Exam submissions** for the course.
3. Open a submission marked **Pending review**.

### Platform admin

1. Open **Admin → Courses**.
2. Open the course's action menu (**…**) and select **Quiz/Final Exam submissions**.
3. Open a pending submission.

The submissions list shows the student, quiz lesson, submission time, status, and the number of written answers still pending. The review page shows the student's response to each written question and its maximum marks. The percentage in its header is labelled **Auto-graded score so far** until review finishes.

For **each written answer**:

1. Enter an integer score from **0** through that question's maximum marks.
2. Optionally enter feedback. Feedback can be left blank.
3. Click **Save grade**. Repeat for every written answer in the attempt.

Saving one answer does not finalize an attempt with other ungraded written answers. Once every written answer has a score, the system calculates the final percentage, changes the attempt to **Graded**, and determines whether it meets the quiz passing percentage. A passing attempt marks the quiz lesson complete and can unlock the next lesson. A failing attempt leaves the lesson incomplete; the student can retake the quiz after review.

## Scoring example

Suppose a quiz has two MCQs worth 5 marks each and one written question worth 10 marks. The student earns 10 MCQ marks and later receives 8 written marks. The initial provisional percentage is **10 ÷ 20 = 50%**. After manual grading, the final percentage is **(10 + 8) ÷ 20 = 90%**. With a 70% passing requirement, the student passes **after** the written score is saved.

## What the student sees after grading

The quiz result page shows the latest reviewed attempt's final percentage, pass result, written answers, marks per written question, and any feedback the reviewer entered. If the feedback field was empty, it says that no written feedback was left. While the page is open with a pending submission, it checks for the completed review periodically; the student can also revisit the lesson. The **Retake quiz** action returns after grading.

## Status and data reference

| Attempt status | Meaning | Student lesson completion |
| --- | --- | --- |
| `AUTO_GRADED` | MCQ-only attempt scored at submission. | Complete if the score passes. |
| `PENDING_REVIEW` | At least one written answer still needs a score. | No new completion from this attempt yet. |
| `GRADED` | All written answers have scores; final percentage calculated. | Complete if the final score passes. |

Each submission is a separate `QuizAttempt`. Written responses and their marks and feedback are stored as `WrittenAnswerSubmission` records. `QuizResult` tracks attempts, best score, and whether the student has ever passed that quiz lesson. The written-quiz database migration is `apps/api/prisma/migrations/20261113100000_add_written_quiz_questions_and_reviews/migration.sql`.

## Current behavior to keep in mind

- A reviewer may reopen an answer and change its mark or feedback. The final percentage is recalculated without adding the earlier written mark twice.
- A previously recorded pass remains recorded. Lowering a mark later does **not** automatically revoke an already completed lesson.
- The student result page shows written feedback for the **latest attempt**. Reviewers can see earlier attempts in the course submissions list.
- The course builder stores an optional grading rubric, but the current reviewer page displays the question prompt and student answer rather than the rubric.

## Implementation references

- [Quiz editor](../apps/web/components/shared/quiz-editor.tsx)
- [Student quiz player](../apps/web/app/learn/[slug]/_components/quiz-player.tsx)
- [Instructor submissions](../apps/web/app/instructor/courses/[id]/quiz-submissions/page-client.tsx)
- [Instructor/admin grading page](../apps/web/app/instructor/quiz-submissions/[attemptId]/page-client.tsx)
- [Quiz API and grading logic](../apps/api/src/modules/quiz/quiz.service.ts)
- [Quiz request and response contracts](../packages/shared/src/contracts/quiz.ts)
