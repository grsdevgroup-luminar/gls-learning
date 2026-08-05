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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit your review" : "Rate this course"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-sm font-medium">Your rating</div>
            <StarRatingInput value={rating} onChange={setRating} />
          </div>
          <div>
            <div className="mb-1.5 text-sm font-medium">Title</div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sum up your experience"
              maxLength={80}
            />
          </div>
          <div>
            <div className="mb-1.5 text-sm font-medium">Review</div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What did you like or dislike? Would you recommend this course?"
              className="min-h-28"
              maxLength={1000}
            />
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
