'use client';

import { PostList } from '@/components/PostListContext';
import type { PostMeta, CategoryInfo } from '@/lib/blog';

interface HomeContentProps {
  allPosts: PostMeta[];
  categories: CategoryInfo[];
}

export default function HomeContent({ allPosts, categories }: HomeContentProps) {
  return (
    <PostList.Provider allPosts={allPosts}>
      <PostList.FilterNav categories={categories} />
      <PostList.Grid />
      <PostList.LoadMore />
    </PostList.Provider>
  );
}