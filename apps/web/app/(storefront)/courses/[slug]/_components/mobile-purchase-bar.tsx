"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CourseDetailDto } from "@skillstream/shared";
import { useStore } from "@/lib/context/store";
import { Price } from "@/components/shared/price";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { PlayCircle, ShoppingCart, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { CoursePurchaseCard } from "./course-purchase-card";

/** Mobile-only fixed bottom bar: price + primary actions, with a "More"
 *  tap that opens the same purchase card (discount, includes list,
 *  guarantee) desktop shows in the sticky sidebar. Desktop hides this
 *  entirely and keeps the sticky sidebar instead. */
export function MobilePurchaseBar({ course }: { course: CourseDetailDto }) {
  const { inCart, addToCart, isEnrolled } = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
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

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur supports-backdrop-filter:bg-background/85 lg:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-1 text-left"
          >
            <Price
              basePrice={course.basePriceCents / 100}
              originalPrice={course.originalPriceCents ? course.originalPriceCents / 100 : undefined}
              size="sm"
              showLocal={false}
            />
            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>

          {enrolled ? (
            <Button size="sm" render={<Link href={`/learn/${course.slug}`} />}>
              <PlayCircle /> Go to course
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                aria-label={inCartNow ? "Go to cart" : "Add to cart"}
                onClick={inCartNow ? () => router.push("/cart") : add}
              >
                <ShoppingCart />
              </Button>
              <Button size="sm" onClick={buyNow}>
                Buy now
              </Button>
            </>
          )}
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetTitle className="sr-only">Course purchase details</SheetTitle>
          <div className="p-4 pt-8">
            <CoursePurchaseCard course={course} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
