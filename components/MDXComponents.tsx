import Link from "next/link";
import type { ComponentPropsWithoutRef, ElementType } from "react";

type MDXComponentsType = {
  [key: string]: ElementType;
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const MDXComponents: MDXComponentsType = {
  h1: ({ children }: ComponentPropsWithoutRef<"h1">) => {
    const id = slugify(String(children));
    return (
      <h1
        id={id}
        className="text-4xl font-semibold tracking-tight text-[var(--foreground)] mb-6 scroll-mt-24"
      >
        {children}
      </h1>
    );
  },
  h2: ({ children }: ComponentPropsWithoutRef<"h2">) => {
    const id = slugify(String(children));
    return (
      <h2
        id={id}
        className="text-2xl font-semibold tracking-tight text-[var(--foreground)] mt-12 mb-4 scroll-mt-24"
      >
        {children}
      </h2>
    );
  },
  h3: ({ children }: ComponentPropsWithoutRef<"h3">) => {
    const id = slugify(String(children));
    return (
      <h3
        id={id}
        className="text-xl font-semibold tracking-tight text-[var(--foreground)] mt-8 mb-3 scroll-mt-24"
      >
        {children}
      </h3>
    );
  },
  p: ({ children }: ComponentPropsWithoutRef<"p">) => (
    <p className="text-[var(--muted)] leading-relaxed mb-4">
      {children}
    </p>
  ),
  a: ({ href, children }: ComponentPropsWithoutRef<"a">) => (
    <Link
      href={href || "#"}
      className="text-[var(--link)] hover:underline"
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
    >
      {children}
    </Link>
  ),
  ul: ({ children }: ComponentPropsWithoutRef<"ul">) => (
    <ul className="list-disc list-inside text-[var(--muted)] mb-4 space-y-2">
      {children}
    </ul>
  ),
  ol: ({ children }: ComponentPropsWithoutRef<"ol">) => (
    <ol className="list-decimal list-inside text-[var(--muted)] mb-4 space-y-2">
      {children}
    </ol>
  ),
  li: ({ children }: ComponentPropsWithoutRef<"li">) => (
    <li className="text-[var(--muted)]">{children}</li>
  ),
  blockquote: ({ children }: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote className="border-l-4 border-[var(--link)] pl-4 my-4 italic text-[var(--muted)]">
      {children}
    </blockquote>
  ),
  code: ({
    children,
    className,
  }: ComponentPropsWithoutRef<"code"> & { className?: string }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-[var(--code-bg)] text-[var(--code-foreground)] text-sm px-1.5 py-0.5 rounded font-mono">
          {children}
        </code>
      );
    }
    return <code className={className}>{children}</code>;
  },
  pre: ({ children }: ComponentPropsWithoutRef<"pre">) => (
    <pre className="bg-[var(--code-bg)] text-[var(--code-foreground)] rounded-lg overflow-x-auto my-6 p-4 text-sm">
      {children}
    </pre>
  ),
  table: ({ children }: ComponentPropsWithoutRef<"table">) => (
    <div className="overflow-x-auto my-6">
      <table className="min-w-full border border-[var(--border)] rounded-lg overflow-hidden">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: ComponentPropsWithoutRef<"thead">) => (
    <thead className="bg-[var(--card-bg)]">{children}</thead>
  ),
  th: ({ children }: ComponentPropsWithoutRef<"th">) => (
    <th className="text-left px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
      {children}
    </th>
  ),
  td: ({ children }: ComponentPropsWithoutRef<"td">) => (
    <td className="px-4 py-3 text-sm text-[var(--muted)] border-t border-[var(--border)]">
      {children}
    </td>
  ),
  hr: () => (
    <hr className="my-8 border-[var(--border)]" />
  ),
  strong: ({ children }: ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-semibold text-[var(--foreground)]">
      {children}
    </strong>
  ),
};