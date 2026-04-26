import Link from 'next/link';
import type { PostMeta } from '@/lib/blog';

interface PrevNextNavProps {
  prev: PostMeta | null;
  next: PostMeta | null;
}

export default function PrevNextNav({ prev, next }: PrevNextNavProps) {
  if (!prev && !next) return null;

  return (
    <nav className="flex items-center justify-between gap-4 mt-16 pt-8 border-t border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.1)]">
      <div>
        {prev && (
          <Link
            href={`/${prev.category}/${prev.slug}`}
            className="group flex flex-col gap-1"
          >
            <span className="text-xs text-[#666] dark:text-[#888]">← Previous</span>
            <span className="text-sm font-medium text-[#171717] dark:text-[#ededed] group-hover:text-[#0072f5] transition-colors">
              {prev.title}
            </span>
          </Link>
        )}
      </div>
      <div>
        {next && (
          <Link
            href={`/${next.category}/${next.slug}`}
            className="group flex flex-col gap-1 text-right"
          >
            <span className="text-xs text-[#666] dark:text-[#888]">Next →</span>
            <span className="text-sm font-medium text-[#171717] dark:text-[#ededed] group-hover:text-[#0072f5] transition-colors">
              {next.title}
            </span>
          </Link>
        )}
      </div>
    </nav>
  );
}