import { Stars } from "@/components/shared/stars";

/** Pure/presentational — no client state, safe on the server. */
export function RatingBars({
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
