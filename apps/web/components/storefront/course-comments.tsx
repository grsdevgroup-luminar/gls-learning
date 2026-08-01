"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { useCourseComments, usePostComment } from "@/lib/api/hooks";
import { useSession } from "@/lib/api/session";
import { getApiErrorMessage } from "@/lib/api/errors";
import { initials, relativeDate } from "@/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const MAX = 2000;

/** Flat, newest-first course discussion. Reading is public; posting needs a
 *  session, matching the API's gate. */
export function CourseComments({ courseId }: { courseId: string }) {
  const { user } = useSession();
  const { data, isLoading } = useCourseComments(courseId);
  const post = usePostComment(courseId);
  const [body, setBody] = useState("");

  const comments = data?.items ?? [];

  function submit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    post.mutate(
      { body: trimmed },
      {
        onSuccess: () => setBody(""),
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  }

  return (
    <div className="border-t border-border pt-8">
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">Discussion</h2>
        {data && (
          <span className="text-sm text-muted-foreground">
            {data.total.toLocaleString()}
          </span>
        )}
      </div>

      {user ? (
        <div className="mb-6 space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX))}
            placeholder="Ask a question or share something you learned…"
            rows={3}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {body.length}/{MAX}
            </span>
            <Button
              size="sm"
              onClick={submit}
              disabled={!body.trim() || post.isPending}
            >
              {post.isPending ? "Posting…" : "Post comment"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mb-6 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>{" "}
          to join the discussion.
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading discussion…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No comments yet — be the first to start the conversation.
        </p>
      ) : (
        <ul className="space-y-5">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar className="h-9 w-9 shrink-0">
                {c.avatar && <AvatarImage src={c.avatar} alt="" />}
                <AvatarFallback>{initials(c.author)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium">{c.author}</span>
                  <span className="text-xs text-muted-foreground">
                    {relativeDate(c.createdAt)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                  {c.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
