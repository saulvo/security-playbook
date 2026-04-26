'use client';

import { PostList } from '@/components/PostListContext';
import type { PostMeta } from '@/lib/blog';

interface CategoryContentProps {
  posts: PostMeta[];
  category: string;
}

export default function CategoryContent({ posts, category }: CategoryContentProps) {
  return (
    <PostList.Provider allPosts={posts} initialCategory={category}>
      <PostList.Grid />
      <PostList.LoadMore />
    </PostList.Provider>
  );
}