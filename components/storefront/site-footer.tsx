import Link from "next/link";
import { Logo } from "@/components/shared/logo";

const cols = [
  {
    title: "Platform",
    links: [
      ["Browse courses", "/courses"],
      ["Student dashboard", "/dashboard"],
      ["Admin panel", "/admin"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "#"],
      ["Careers", "#"],
      ["Blog", "#"],
    ],
  },
  {
    title: "Support",
    links: [
      ["Help center", "#"],
      ["Contact", "#"],
      ["Terms & privacy", "#"],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-muted/30">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 md:grid-cols-5">
        <div className="col-span-2">
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Learn in-demand skills from world-class instructors. Region-fair pricing,
            protected content, and progress that keeps you going.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h4 className="mb-3 text-sm font-semibold">{c.title}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="hover:text-foreground">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">
        © 2026 LearnHub — prototype for client review. Not a live store.
      </div>
    </footer>
  );
}
