import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({
  className,
  href = '/',
  iconOnly = false,
}: {
  className?: string;
  href?: string;
  iconOnly?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label="SkillStream home"
      className={cn('flex items-center gap-2 font-bold', className)}
    >
      <span className="brand-gradient grid h-8 w-8 place-items-center rounded-lg text-white shadow-sm">
        <GraduationCap className="h-5 w-5" />
      </span>
      {!iconOnly && <span className="text-lg tracking-tight">SkillStream</span>}
    </Link>
  );
}
