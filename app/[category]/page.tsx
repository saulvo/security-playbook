import { getAllCategories, getPostsByCategory } from '@/lib/blog';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CategoryContent from '@/components/CategoryContent';

interface PageProps {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  const categories = getAllCategories();
  return categories.map((cat) => ({
    category: cat.slug,
  }));
}

export async function generateMetadata({ params }: PageProps) {
  const { category } = await params;
  const categories = getAllCategories();
  const categoryInfo = categories.find((c) => c.slug === category);

  return {
    title: categoryInfo?.name || category,
    description: `Browse all ${categoryInfo?.name || category} posts`,
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { category } = await params;
  const categories = getAllCategories();
  const categoryInfo = categories.find((c) => c.slug === category);
  const posts = getPostsByCategory(category);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground mb-4">
            {categoryInfo?.name || category}
          </h1>
          <p className="text-lg text-muted">
            {posts.length} {posts.length === 1 ? 'article' : 'articles'}
          </p>
        </div>
        <CategoryContent posts={posts} category={category} />
      </main>
      <Footer />
    </div>
  );
}