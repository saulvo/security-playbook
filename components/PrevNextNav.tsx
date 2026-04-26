import Link from 'next/link';
import type { PostMeta } from '@/lib/blog';

interface PrevNextNavProps {
  prev: PostMeta | null;
  next: PostMeta | null;
}

export default function PrevNextNav({ prev, next }: PrevNextNavProps) {
  if (!prev && !next) return null;

  return (
    <nav className="flex items-center justify-between gap-4 mt-16 pt-8 border-t border-border">
      <div>
        {prev && (
          <Link
            href={`/${prev.category}/${prev.slug}`}
            className="group flex flex-col gap-1"
          >
            <span className="text-xs text-muted">← Previous</span>
            <span className="text-sm font-medium text-foreground group-hover:text-link transition-colors">
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
            <span className="text-xs text-muted">Next →</span>
            <span className="text-sm font-medium text-foreground group-hover:text-link transition-colors">
              {next.title}
            </span>
          </Link>
        )}
      </div>
    </nav>
  );
}