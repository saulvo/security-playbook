import { getAllPosts, getAllCategories } from '@/lib/blog';
import HomeContent from '@/components/HomeContent';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function HomePage() {
  const allPosts = getAllPosts();
  const categories = getAllCategories();

  return (
    <div className="min-h-screen flex flex-col bg-background dark:bg-background">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground dark:text-foreground mb-4">
            Security Playbook
          </h1>
          <p className="text-lg text-muted dark:text-muted">
            A comprehensive guide to frontend security best practices
          </p>
        </div>
        <HomeContent allPosts={allPosts} categories={categories} />
      </main>
      <Footer />
    </div>
  );
}
