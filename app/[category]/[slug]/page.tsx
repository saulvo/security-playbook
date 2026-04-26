import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypePrettyCode from "rehype-pretty-code";
import { getPostBySlug, getAdjacentPosts, getAllCategories } from "@/lib/blog";
import { extractToc } from "@/lib/toc";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TableOfContents from "@/components/TableOfContents";
import PrevNextNav from "@/components/PrevNextNav";
import { MDXComponents } from "@/components/MDXComponents";

interface PageProps {
  params: Promise<{ category: string; slug: string }>;
}

export async function generateStaticParams() {
  const categories = getAllCategories();
  const params: { category: string; slug: string }[] = [];

  for (const cat of categories) {
    const { getPostsByCategory } = await import("@/lib/blog");
    const posts = getPostsByCategory(cat.slug);
    for (const post of posts) {
      params.push({ category: cat.slug, slug: post.slug });
    }
  }

  return params;
}

export async function generateMetadata({ params }: PageProps) {
  const { category, slug } = await params;
  const post = getPostBySlug(category, slug);

  if (!post) return { title: "Not Found" };

  return {
    title: post.title,
    description: post.description,
    tags: post.tags,
  };
}

export default async function PostPage({ params }: PageProps) {
  const { category, slug } = await params;
  const post = getPostBySlug(category, slug);

  if (!post) notFound();

  const toc = extractToc(post.content);
  const { prev, next } = getAdjacentPosts(category, slug);
  const categories = getAllCategories();
  const categoryInfo = categories.find((c) => c.slug === category);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0a0a0a]">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-16">
        <div className="mb-4">
          <Link
            href={`/${category}`}
            className="text-sm text-[#0072f5] hover:underline"
          >
            ← {categoryInfo?.name || category}
          </Link>
        </div>

        <article className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-12">
          <div>
            <header className="mb-12 pb-8 border-b border-[rgba(0,0,0,0.08)] dark:border-[rgba(255,255,255,0.1)]">
              <h1 className="text-4xl font-semibold tracking-tight text-[#171717] dark:text-[#ededed] mb-4">
                {post.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-[#666] dark:text-[#888]">
                <span>{post.date}</span>
                <span>•</span>
                <span>{post.readingTime}</span>
                <span>•</span>
                <span>{post.author}</span>
              </div>
              {post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs font-medium text-[#0068d6] bg-[#ebf5ff] dark:bg-[#0068d6]/20 dark:text-[#69b4ff] px-2 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </header>

            <div className="prose prose-lg dark:prose-invert max-w-none">
              <MDXRemote
                source={post.content}
                components={MDXComponents}
                options={{
                  mdxOptions: {
                    remarkPlugins: [remarkGfm],
                    rehypePlugins: [
                      [
                        rehypePrettyCode,
                        { theme: "tokyo-night", keepBackground: false },
                      ],
                    ],
                  },
                }}
              />
            </div>

            <PrevNextNav prev={prev} next={next} />
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <TableOfContents items={toc} />
            </div>
          </aside>
        </article>
      </main>
      <Footer />
    </div>
  );
}
