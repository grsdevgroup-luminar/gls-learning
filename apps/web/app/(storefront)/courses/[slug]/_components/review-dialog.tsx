"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { StarRatingInput } from "@/components/shared/star-rating-input";
import { PenLine } from "lucide-react";
import { toast } from "sonner";

const REVIEW_TITLE_MAX_LENGTH = 160;
const REVIEW_BODY_MAX_LENGTH = 4000;

export function ReviewDialog({
  courseId,
  existing,
  onSubmit,
}: {
  courseId: string;
  existing?: { rating: number; title: string; body: string };
  onSubmit: (
    courseId: string,
    rating: number,
    title: string,
    body: string,
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setRating(existing?.rating ?? 0);
      setTitle(existing?.title ?? "");
      setBody(existing?.body ?? "");
    }
  }

  function submit() {
    if (!rating) {
      toast.error("Please select a star rating");
      return;
    }
    onSubmit(courseId, rating, title.trim() || "Untitled review", body.trim());
    toast.success(existing ? "Review updated" : "Review submitted", {
      description: "Thanks for sharing your feedback!",
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <PenLine className="h-3.5 w-3.5" />{" "}
        {existing ? "Edit your review" : "Write a review"}
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit your review" : "Rate this course"}</DialogTitle>
        </DialogHeader>
        <div className="min-w-0 space-y-4">
          <div className="min-w-0">
            <div className="mb-1.5 text-sm font-medium">Your rating</div>
            <StarRatingInput value={rating} onChange={setRating} />
          </div>
          <div className="min-w-0">
            <div className="mb-1.5 text-sm font-medium">Title</div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sum up your experience"
              className="max-w-full"
              maxLength={REVIEW_TITLE_MAX_LENGTH}
            />
            <div className="mt-1 text-right text-xs text-muted-foreground">
              {title.length} / {REVIEW_TITLE_MAX_LENGTH} characters
            </div>
          </div>
          <div className="min-w-0">
            <div className="mb-1.5 text-sm font-medium">Review</div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What did you like or dislike? Would you recommend this course?"
              className="min-h-28 max-h-48 min-w-0 max-w-full resize-y overflow-auto break-all [field-sizing:fixed]"
              maxLength={REVIEW_BODY_MAX_LENGTH}
            />
            <div className="mt-1 text-right text-xs text-muted-foreground">
              {body.length.toLocaleString()} / {REVIEW_BODY_MAX_LENGTH.toLocaleString()} characters
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={submit}>{existing ? "Update review" : "Submit review"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
