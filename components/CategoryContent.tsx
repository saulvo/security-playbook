'use client';

import { useState } from 'react';
import BlogCard from '@/components/BlogCard';
import type { PostMeta } from '@/lib/blog';

const INITIAL_COUNT = 10;
const LOAD_MORE_COUNT = 10;

interface CategoryContentProps {
  posts: PostMeta[];
}

export default function CategoryContent({ posts }: CategoryContentProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);

  const visiblePosts = posts.slice(0, visibleCount);
  const hasMore = visibleCount < posts.length;

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
        {visiblePosts.map((post) => (
          <BlogCard key={post.slug} post={post} />
        ))}
      </div>

      {hasMore && (
        <div className="mt-12 text-center">
          <button
            onClick={() => setVisibleCount((c) => c + LOAD_MORE_COUNT)}
            className="px-6 py-3 text-sm font-medium bg-[#171717] text-white dark:bg-[#ededed] dark:text-[#171717] rounded-full hover:opacity-90 transition-opacity"
          >
            Load More
          </button>
        </div>
      )}
    </>
  );
}