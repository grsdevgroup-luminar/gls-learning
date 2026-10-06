"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare, Reply as ReplyIcon } from "lucide-react";
import { useCourseComments, usePostComment } from "@/lib/api/hooks";
import { useSession } from "@/lib/api/session";
import { getApiErrorMessage } from "@/lib/api/errors";
import { initials, relativeDate } from "@/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { DiscussionSkeleton } from "@/components/shared/loading-skeletons";

const MAX = 2000;

/** Flat, newest-first course discussion. Reading is public; posting needs a
 *  session, matching the API's gate. */
export function CourseComments({ courseId }: { courseId: string }) {
  const { user } = useSession();
  const { data, isLoading } = useCourseComments(courseId);
  const post = usePostComment(courseId);
  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const comments = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="max-w-full border-t border-border pt-8">
        <div className="mb-5 flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary" /><h2 className="text-xl font-bold">Discussion</h2></div>
        <DiscussionSkeleton />
      </div>
    );
  }

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

  function submitReply(parentId: string) {
    const trimmed = replyBody.trim();
    if (!trimmed) return;
    post.mutate(
      { body: trimmed, parentId },
      {
        onSuccess: () => {
          setReplyBody("");
          setReplyingTo(null);
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  }

  return (
    <div className="max-w-full border-t border-border pt-8">
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
          {comments?.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar className="h-9 w-9 shrink-0">
                {c.avatar && <AvatarImage src={c.avatar} alt="" />}
                <AvatarFallback>{initials(c.author)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium">{c.author}</span>
                  <span className="text-xs text-muted-foreground">{relativeDate(c.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{c.body}</p>
                {user && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => {
                      setReplyingTo((current) => current === c.id ? null : c.id);
                      setReplyBody("");
                    }}
                  >
                    <ReplyIcon className="mr-1 h-3.5 w-3.5" /> Reply
                  </Button>
                )}
                {replyingTo === c.id && (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      value={replyBody}
                      onChange={(event) => setReplyBody(event.target.value.slice(0, MAX))}
                      placeholder={`Reply to ${c.author}…`}
                      rows={2}
                      aria-label={`Reply to ${c.author}`}
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setReplyingTo(null)}>Cancel</Button>
                      <Button type="button" size="sm" disabled={!replyBody.trim() || post.isPending} onClick={() => submitReply(c.id)}>
                        {post.isPending ? "Replying…" : "Post reply"}
                      </Button>
                    </div>
                  </div>
                )}
                {(c.replies?.length ?? 0) > 0 && (
                  <ul className="mt-3 space-y-3 border-l-2 pl-4">
                    {c.replies?.map((reply) => (
                      <li key={reply.id} className="flex gap-2.5">
                        <Avatar className="h-7 w-7 shrink-0">
                          {reply.avatar && <AvatarImage src={reply.avatar} alt="" />}
                          <AvatarFallback>{initials(reply.author)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-medium">{reply.author}</span>
                            <span className="text-xs text-muted-foreground">{relativeDate(reply.createdAt)}</span>
                          </div>
                          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{reply.body}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
