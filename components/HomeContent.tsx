'use client';

import { useState } from 'react';
import BlogCard from '@/components/BlogCard';
import type { PostMeta, CategoryInfo } from '@/lib/blog';

const INITIAL_COUNT = 10;
const LOAD_MORE_COUNT = 10;

interface HomeContentProps {
  allPosts: PostMeta[];
  categories: CategoryInfo[];
}

export default function HomeContent({ allPosts, categories }: HomeContentProps) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);

  const handleFilter = (category: string) => {
    setSelectedCategory(category);
    setVisibleCount(INITIAL_COUNT);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredPosts =
    selectedCategory === 'all'
      ? allPosts
      : allPosts.filter((post) => post.category === selectedCategory);

  const visiblePosts = filteredPosts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredPosts.length;

  return (
    <>
      <nav className="flex flex-wrap gap-6 mb-8 border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.1)] pb-4">
        <button
          onClick={() => handleFilter('all')}
          className={`text-sm font-medium transition-colors ${
            selectedCategory === 'all'
              ? 'text-[#171717] dark:text-[#ededed]'
              : 'text-[#666] dark:text-[#888] hover:text-[#171717] dark:hover:text-[#ededed]'
          }`}
        >
          All Posts
        </button>
        {categories.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => handleFilter(cat.slug)}
            className={`text-sm font-medium transition-colors ${
              selectedCategory === cat.slug
                ? 'text-[#171717] dark:text-[#ededed]'
                : 'text-[#666] dark:text-[#888] hover:text-[#171717] dark:hover:text-[#ededed]'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </nav>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
        {visiblePosts.map((post) => (
          <BlogCard key={`${post.category}-${post.slug}`} post={post} />
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