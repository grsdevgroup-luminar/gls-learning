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
        src={iconOnly ? '/GRS-Mark.svg' : '/GRS-Learning.svg'}
        alt="GRS Learning logo"
        width={iconOnly ? 1525 : 1536}
        height={iconOnly ? 742 : 1024}
        sizes="85px"
        loading="eager"
        className="h-auto w-[85px] shrink-0 -translate-y-1 dark:hidden"
      />
      <Image
        src={iconOnly ? '/GRS-Mark-Dark.svg' : '/GRS-Learning-Dark.svg'}
        alt="GRS Learning logo"
        width={iconOnly ? 1525 : 1536}
        height={iconOnly ? 742 : 1024}
        sizes="85px"
        loading="eager"
        className="hidden h-auto w-[85px] shrink-0 -translate-y-1 dark:block"
      />
    </Link>
  );
}

