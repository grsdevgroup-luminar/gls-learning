import Link from 'next/link';
import { cn } from '@/lib/utils';
import Image from 'next/image';

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
      aria-label="GRS Learning home"
      className={cn('flex items-center gap-2 font-bold', className)}
    >
  <Image
  src="/GRS-Learning.svg"
  alt="GRS Learning logo"
  width={85}
  height={85}
  className="shrink-0 -translate-y-1"
/>
    </Link>
  );
}

