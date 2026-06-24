'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Course } from '@/types';
import { useStore } from '@/lib/context/store';
import { getInstructor } from '@/lib/mock/instructors';
import { reviewsForCourse } from '@/lib/mock/reviews';
import {
  courseDurationMin,
  courseLessonCount,
  courseArticleCount,
  courseResourceCount,
} from '@/lib/mock/courses';
import { demoStudent } from '@/lib/mock/students';
import { ProtectedPlayer } from '@/components/player/protected-player';
import { Price } from '@/components/shared/price';
import { Stars } from '@/components/shared/stars';
import { StarRatingInput } from '@/components/shared/star-rating-input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Check,
  PlayCircle,
  FileText,
  HelpCircle,
  Clock,
  Users,
  Globe,
  BarChart3,
  ShoppingCart,
  ShieldCheck,
  Infinity as InfinityIcon,
  Award,
  ThumbsUp,
  Lock,
  Star,
  PenLine,
  ClipboardList,
  Smartphone,
} from 'lucide-react';
import {
  compactNumber,
  formatHoursFromMin,
  lessonTime,
  initials,
  relativeDate,
} from '@/lib/format';
import { toast } from 'sonner';

export function CourseDetail({ course }: { course: Course }) {
  const {
    inCart,
    addToCart,
    isEnrolled,
    role,
    getMyReview,
    submitReview,
    mounted,
  } = useStore();
  const router = useRouter();
  const instructor = getInstructor(course.instructorId);
  const baseReviews = reviewsForCourse(course.id);
  const enrolled = isEnrolled(course.id);
  const myReview = mounted ? getMyReview(course.id) : undefined;
  const reviews = myReview
    ? [
        {
          id: 'mine',
          courseId: course.id,
          author: demoStudent.name,
          avatar: '',
          rating: myReview.rating,
          date: myReview.date,
          title: myReview.title,
          body: myReview.body,
          status: 'approved' as const,
          helpful: 0,
        },
        ...baseReviews,
      ]
    : baseReviews;
  const inCartNow = inCart(course.id);
  const watermark =
    role === 'guest' ? 'preview@SkillStream' : demoStudent.email;

  const previewLesson =
    course.sections.flatMap((s) => s.lessons).find((l) => l.preview) ??
    course.sections[0].lessons[0];

  function add() {
    addToCart(course.id);
    toast.success('Added to cart', { description: course.title });
  }
  function buyNow() {
    addToCart(course.id);
    router.push('/checkout');
  }

  return (
    <>
      {/* Hero */}
      <section className="border-b bg-foreground text-background dark:bg-card dark:text-foreground">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-32 pt-10 lg:grid-cols-[1fr_380px] lg:pb-40">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{course.category}</Badge>
              {course.bestseller && (
                <Badge className="bg-amber-400 text-amber-950 hover:bg-amber-400">
                  Bestseller
                </Badge>
              )}
              <span className="text-sm opacity-80">{course.level}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              {course.title}
            </h1>
            <p className="mt-3 max-w-2xl text-lg opacity-90">
              {course.subtitle}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span className="flex items-center gap-1.5">
                <Stars rating={course.rating} showValue size={15} />
                <span className="opacity-80">
                  ({compactNumber(course.reviewCount)} ratings)
                </span>
              </span>
              <span className="flex items-center gap-1.5 opacity-90">
                <Users className="h-4 w-4" />{' '}
                {compactNumber(course.studentCount)} students
              </span>
              <span className="flex items-center gap-1.5 opacity-90">
                <Globe className="h-4 w-4" /> {course.language}
              </span>
              <span className="flex items-center gap-1.5 opacity-90">
                <Clock className="h-4 w-4" /> Updated{' '}
                {relativeDate(course.updatedAt)}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                  {instructor ? initials(instructor.name) : '?'}
                </AvatarFallback>
              </Avatar>
              <span className="opacity-90">
                Created by{' '}
                <span className="font-medium">{instructor?.name}</span>
              </span>
            </div>
          </div>

          {/* spacer for the floating card on desktop */}
          <div className="hidden lg:block" />
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 pb-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-10 pt-10">
          {/* Preview player */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Free preview</h2>
              <Badge variant="outline" className="ml-1 gap-1">
                <ShieldCheck className="h-3 w-3" /> Protected stream
              </Badge>
            </div>
            <ProtectedPlayer
              title={previewLesson.title}
              durationSec={previewLesson.durationSec}
              watermark={watermark}
              seed={course.thumbnail}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Demo: video is DRM-streamed with a per-student moving watermark,
              disabled right-click, and no downloadable source. Real builds use
              signed HLS + Widevine/FairPlay.
            </p>
          </div>

          {/* What you'll learn */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-4 text-xl font-bold">What you'll learn</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {course.whatYouLearn.map((w) => (
                  <div key={w} className="flex gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Curriculum */}
          <div>
            <div className="mb-3 flex items-end justify-between">
              <h2 className="text-xl font-bold">Course content</h2>
              <span className="text-sm text-muted-foreground">
                {course.sections.length} sections · {courseLessonCount(course)}{' '}
                lessons · {formatHoursFromMin(courseDurationMin(course))}
              </span>
            </div>
            <Card className="p-0">
              <Accordion defaultValue={[course.sections[0].id]}>
                {course.sections.map((s) => (
                  <AccordionItem key={s.id} value={s.id} className="px-4">
                    <AccordionTrigger>
                      <div className="flex w-full items-center justify-between pr-3">
                        <span className="font-medium">{s.title}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {s.lessons.length} lessons
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-1 pb-2">
                        {s.lessons.map((l) => (
                          <li
                            key={l.id}
                            className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                          >
                            {l.type === 'video' ? (
                              <PlayCircle className="h-4 w-4 text-muted-foreground" />
                            ) : l.type === 'quiz' ? (
                              <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <FileText className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="flex-1">{l.title}</span>
                            {l.preview ? (
                              <Badge
                                variant="outline"
                                className="h-5 text-[10px]"
                              >
                                Preview
                              </Badge>
                            ) : (
                              <Lock className="h-3 w-3 text-muted-foreground/60" />
                            )}
                            <span className="tabular-nums text-xs text-muted-foreground">
                              {lessonTime(l.durationSec)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Card>
          </div>

          {/* Requirements + description */}
          <div>
            <h2 className="mb-3 text-xl font-bold">Requirements</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              {course.requirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <h2 className="mb-3 mt-8 text-xl font-bold">Description</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {course.description}
            </p>
          </div>

          {/* Instructor */}
          {instructor && (
            <div>
              <h2 className="mb-4 text-xl font-bold">Your instructor</h2>
              <Card>
                <CardContent className="flex gap-4 pt-6">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="brand-gradient text-lg text-white">
                      {initials(instructor.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">{instructor.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {instructor.title}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Stars rating={instructor.rating} size={12} showValue />{' '}
                        rating
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />{' '}
                        {compactNumber(instructor.students)} students
                      </span>
                      <span className="flex items-center gap-1">
                        <BarChart3 className="h-3.5 w-3.5" />{' '}
                        {instructor.courses} courses
                      </span>
                    </div>
                    <p className="mt-3 text-sm">{instructor.bio}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Reviews */}
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold">Student reviews</h2>
                <span className="flex items-center gap-1 text-sm">
                  <Stars rating={course.rating} showValue size={15} />
                  <span className="text-muted-foreground">
                    · {compactNumber(course.reviewCount)} reviews
                  </span>
                </span>
              </div>
              {enrolled && (
                <ReviewDialog
                  courseId={course.id}
                  existing={myReview}
                  onSubmit={submitReview}
                />
              )}
            </div>
            <RatingBars reviews={reviews} rating={course.rating} />
            <div className="mt-6 space-y-5">
              {reviews.slice(0, 6).map((r) => (
                <div key={r.id} className="border-b pb-5 last:border-0">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs">
                        {initials(r.author)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {r.author}
                        {r.id === 'mine' && (
                          <Badge variant="secondary" className="text-[10px]">
                            You
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Stars rating={r.rating} size={12} /> ·{' '}
                        {relativeDate(r.date)}
                      </div>
                    </div>
                  </div>
                  <h4 className="mt-2 text-sm font-semibold">{r.title}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
                  <button className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <ThumbsUp className="h-3.5 w-3.5" /> Helpful ({r.helpful})
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Purchase card — pulled up to overlap the hero, then sticky */}
        <div className="order-first lg:order-none lg:-mt-32">
          <PurchaseCard
            course={course}
            enrolled={enrolled}
            inCart={inCartNow}
            onAdd={add}
            onBuy={buyNow}
          />
        </div>
      </div>
    </>
  );
}

function PurchaseCard({
  course,
  enrolled,
  inCart,
  onAdd,
  onBuy,
}: {
  course: Course;
  enrolled: boolean;
  inCart: boolean;
  onAdd: () => void;
  onBuy: () => void;
}) {
  const articleCount = courseArticleCount(course);
  const resourceCount = courseResourceCount(course);
  const includes = [
    {
      icon: PlayCircle,
      label: `${formatHoursFromMin(courseDurationMin(course))} on-demand video`,
    },
    { icon: ClipboardList, label: 'Assignments' },
    ...(articleCount > 0
      ? [
          {
            icon: FileText,
            label: `${articleCount} article${articleCount === 1 ? '' : 's'}`,
          },
        ]
      : []),
    ...(resourceCount > 0
      ? [
          {
            icon: FileText,
            label: `${resourceCount} downloadable resource${resourceCount === 1 ? '' : 's'}`,
          },
        ]
      : []),
    { icon: Smartphone, label: 'Access on mobile and TV' },
    { icon: InfinityIcon, label: 'Full lifetime access' },
    { icon: ShieldCheck, label: 'DRM-protected streaming' },
    { icon: Award, label: 'Certificate of completion' },
  ];
  return (
    <Card className="overflow-hidden shadow-xl lg:sticky lg:top-20">
      <div className="brand-gradient h-2" />
      <CardContent className="space-y-4 pt-6">
        <Price
          basePrice={course.basePrice}
          originalPrice={course.originalPrice}
          size="lg"
        />
        {course.originalPrice && (
          <Badge variant="secondary" className="text-success">
            {Math.round((1 - course.basePrice / course.originalPrice) * 100)}%
            off · limited time
          </Badge>
        )}

        {enrolled ? (
          <Button
            className="w-full"
            size="lg"
            render={<Link href={`/learn/${course.slug}`} />}
          >
            <PlayCircle /> Go to course
          </Button>
        ) : (
          <div className="space-y-2">
            {inCart ? (
              <Button
                className="w-full"
                size="lg"
                variant="outline"
                render={<Link href="/cart" />}
              >
                <ShoppingCart /> Go to cart
              </Button>
            ) : (
              <Button
                className="w-full"
                size="lg"
                variant="outline"
                onClick={onAdd}
              >
                <ShoppingCart /> Add to cart
              </Button>
            )}
            <Button className="w-full" size="lg" onClick={onBuy}>
              Buy now
            </Button>
          </div>
        )}
        <p className="text-center text-xs text-muted-foreground">
          30-day money-back guarantee
        </p>

        <Separator />
        <div>
          <h4 className="mb-2 text-sm font-semibold">This course includes</h4>
          <ul className="space-y-2 text-sm">
            {includes.map((i) => (
              <li
                key={i.label}
                className="flex items-center gap-2 text-muted-foreground"
              >
                <i.icon className="h-4 w-4 text-foreground" /> {i.label}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewDialog({
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
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setRating(existing?.rating ?? 0);
      setTitle(existing?.title ?? '');
      setBody(existing?.body ?? '');
    }
  }

  function submit() {
    if (!rating) {
      toast.error('Please select a star rating');
      return;
    }
    onSubmit(courseId, rating, title.trim() || 'Untitled review', body.trim());
    toast.success(existing ? 'Review updated' : 'Review submitted', {
      description: 'Thanks for sharing your feedback!',
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <PenLine className="h-3.5 w-3.5" />{' '}
        {existing ? 'Edit your review' : 'Write a review'}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {existing ? 'Edit your review' : 'Rate this course'}
          </DialogTitle>
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
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button onClick={submit}>
            {existing ? 'Update review' : 'Submit review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RatingBars({
  reviews,
  rating,
}: {
  reviews: { rating: number }[];
  rating: number;
}) {
  const counts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    n: reviews.filter((r) => Math.round(r.rating) === star).length,
  }));
  const total = Math.max(1, reviews.length);
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="text-center">
        <div className="text-4xl font-bold">{rating.toFixed(1)}</div>
        <Stars rating={rating} size={16} />
        <div className="mt-1 text-xs text-muted-foreground">Course rating</div>
      </div>
      <div className="flex-1 space-y-1.5">
        {counts.map((c) => (
          <div key={c.star} className="flex items-center gap-2 text-xs">
            <span className="w-8 text-muted-foreground">{c.star}★</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-amber-400"
                style={{ width: `${(c.n / total) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right text-muted-foreground">{c.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
