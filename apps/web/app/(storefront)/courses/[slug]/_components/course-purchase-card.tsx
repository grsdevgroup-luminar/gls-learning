"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CourseDetailDto } from "@skillstream/shared";
import { useStore } from "@/lib/context/store";
import { Price } from "@/components/shared/price";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  PlayCircle,
  FileText,
  ShoppingCart,
  Infinity as InfinityIcon,
  Award,
  ClipboardList,
  Smartphone,
} from "lucide-react";
import { courseArticleCount, courseResourceCount } from "@/lib/course-stats";
import { formatDurationSec } from "@/lib/format";
import { toast } from "sonner";

/** Self-contained cart/enrollment island — everything it needs (enrolled,
 *  cart membership, add/buy) comes from client-only store state, so it
 *  takes just the static `course` and reads the rest itself. */
export function CoursePurchaseCard({ course }: { course: CourseDetailDto }) {
  const { inCart, addToCart, isEnrolled } = useStore();
  const router = useRouter();
  const enrolled = isEnrolled(course.id);
  const inCartNow = inCart(course.id);

  function add() {
    if (inCartNow) {
      toast.info("This course is already in your cart.");
      return;
    }
    addToCart(course.id);
    toast.success("Added to cart", { description: course.title });
  }
  function buyNow() {
    if (inCartNow) {
      toast.info("This course is already in your cart.");
      router.push("/cart#coupon");
      return;
    }
    addToCart(course.id);
    toast.success("Ready when you are", {
      description: "Ready to checkout? Review your cart.",
    });
    router.push("/cart#coupon");
  }

  const articleCount = courseArticleCount(course);
  const resourceCount = courseResourceCount(course);
  const includes = [
    {
      icon: PlayCircle,
      label: `${formatDurationSec(course.durationSec)} on-demand video`,
    },
    { icon: ClipboardList, label: "Assignments" },
    ...(articleCount > 0
      ? [{ icon: FileText, label: `${articleCount} article${articleCount === 1 ? "" : "s"}` }]
      : []),
    ...(resourceCount > 0
      ? [
          {
            icon: FileText,
            label: `${resourceCount} downloadable resource${resourceCount === 1 ? "" : "s"}`,
          },
        ]
      : []),
    { icon: Smartphone, label: "Access on mobile and TV" },
    { icon: InfinityIcon, label: "Full lifetime access" },
    { icon: Award, label: "Certificate of completion" },
  ];

  return (
    <Card className="overflow-hidden shadow-xl lg:sticky lg:top-20">
      <div className="brand-gradient h-2" />
      <CardContent className="space-y-4 pt-6">
        <Price
          basePrice={course.basePriceCents / 100}
          originalPrice={course.originalPriceCents ? course.originalPriceCents / 100 : undefined}
          size="lg"
        />
        {course.originalPriceCents && (
          <Badge variant="secondary" className="text-success">
            {Math.round((1 - course.basePriceCents / course.originalPriceCents) * 100)}% off · limited time
          </Badge>
        )}

        {enrolled ? (
          <Button className="w-full" size="lg" render={<Link href={`/learn/${course.slug}`} />}>
            <PlayCircle /> Go to course
          </Button>
        ) : (
          <div className="space-y-2">
            {inCartNow ? (
              <Button className="w-full" size="lg" variant="outline" render={<Link href="/cart" />}>
                <ShoppingCart /> Go to cart
              </Button>
            ) : (
              <Button className="w-full" size="lg" variant="outline" onClick={add}>
                <ShoppingCart /> Add to cart
              </Button>
            )}
            <Button className="w-full" size="lg" onClick={buyNow}>
              Buy now
            </Button>
          </div>
        )}
        <p className="text-center text-xs text-muted-foreground">30-day money-back guarantee</p>

        <Separator />
        <div>
          <h4 className="mb-2 text-sm font-semibold">This course includes</h4>
          <ul className="space-y-2 text-sm">
            {includes.map((i) => (
              <li key={i.label} className="flex items-center gap-2 text-muted-foreground">
                <i.icon className="h-4 w-4 text-foreground" /> {i.label}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
