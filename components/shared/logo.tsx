import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({
  className,
  href = '/',
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn('flex items-center gap-2 font-bold', className)}
    >
      <span className="brand-gradient grid h-8 w-8 place-items-center rounded-lg text-white shadow-sm">
        <GraduationCap className="h-5 w-5" />
      </span>
      <span className="text-lg tracking-tight">SkillStream</span>
    </Link>
  );
}
