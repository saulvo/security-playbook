import Link from "next/link";
import type { PostMeta } from "@/lib/blog";

interface BlogCardProps {
  post: PostMeta;
}

export default function BlogCard({ post }: BlogCardProps) {
  return (
    <Link href={`/${post.category}/${post.slug}`}>
      <article
        className="p-6 bg-card-bg rounded-lg border border-card-border transition-all duration-200 hover:bg-card-hover-overlay dark:hover:bg-card-hover-overlay"
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <h2 className="text-xl font-semibold text-foreground dark:text-foreground tracking-tight">
            {post.title}
          </h2>
          <span className="text-xs font-medium text-badge-text bg-badge-bg dark:bg-badge-bg dark:text-badge-text px-2 py-1 rounded-full">
            {post.category}
          </span>
        </div>

        {post.description && (
          <p className="text-muted dark:text-muted text-sm mb-4 line-clamp-2">
            {post.description}
          </p>
        )}

        <div className="flex items-center gap-4 text-xs text-muted dark:text-muted">
          <span>{post.readingTime}</span>
          <span>•</span>
          <span>{post.author}</span>
        </div>
      </article>
    </Link>
  );
}

