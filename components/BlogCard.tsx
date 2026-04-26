import Link from "next/link";
import type { PostMeta } from "@/lib/blog";

interface BlogCardProps {
  post: PostMeta;
}

export default function BlogCard({ post }: BlogCardProps) {
  return (
    <Link href={`/${post.category}/${post.slug}`}>
      <article
        className="p-6 bg-white dark:bg-[#1a1a1a] rounded-lg border border-black/[0.06] dark:border-white/[0.08] transition-all duration-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <h2 className="text-xl font-semibold text-[#171717] dark:text-[#ededed] tracking-tight">
            {post.title}
          </h2>
          <span className="text-xs font-medium text-[#0068d6] bg-[#ebf5ff] dark:bg-[#0068d6]/20 dark:text-[#69b4ff] px-2 py-1 rounded-full">
            {post.category}
          </span>
        </div>

        {post.description && (
          <p className="text-[#4d4d4d] dark:text-[#888] text-sm mb-4 line-clamp-2">
            {post.description}
          </p>
        )}

        <div className="flex items-center gap-4 text-xs text-[#666] dark:text-[#888]">
          <span>{post.readingTime}</span>
          <span>•</span>
          <span>{post.author}</span>
        </div>
      </article>
    </Link>
  );
}

