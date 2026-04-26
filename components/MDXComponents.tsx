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
        className="text-4xl font-semibold tracking-tight text-foreground mb-6 scroll-mt-24"
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
        className="text-2xl font-semibold tracking-tight text-foreground mt-12 mb-4 scroll-mt-24"
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
        className="text-xl font-semibold tracking-tight text-foreground mt-8 mb-3 scroll-mt-24"
      >
        {children}
      </h3>
    );
  },
  p: ({ children }: ComponentPropsWithoutRef<"p">) => (
    <p className="text-muted leading-relaxed mb-4">{children}</p>
  ),
  a: ({ href, children }: ComponentPropsWithoutRef<"a">) => (
    <Link
      href={href || "#"}
      className="text-link hover:underline"
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
    >
      {children}
    </Link>
  ),
  ul: ({ children }: ComponentPropsWithoutRef<"ul">) => (
    <ul className="list-disc list-inside text-muted mb-4 space-y-2">
      {children}
    </ul>
  ),
  ol: ({ children }: ComponentPropsWithoutRef<"ol">) => (
    <ol className="list-decimal list-inside text-muted mb-4 space-y-2">
      {children}
    </ol>
  ),
  li: ({ children }: ComponentPropsWithoutRef<"li">) => {
    let hasCheckbox = false;

    const checkChildren = (child: unknown) => {
      if (!child) return;
      if (Array.isArray(child)) {
        child.forEach(checkChildren);
      } else if (typeof child === "object" && child !== null) {
        if ((child as { type?: string }).type === "input" && (child as { props?: { type?: string } }).props?.type === "checkbox") {
          hasCheckbox = true;
        }
        if ((child as { props?: { children?: unknown } }).props?.children) {
          checkChildren((child as { props: { children: unknown } }).props.children);
        }
      }
    };

    checkChildren(children);

    return (
      <li className={hasCheckbox ? "list-none" : "text-muted"}>
        {children}
      </li>
    );
  },
  blockquote: ({ children }: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote className="border-l-4 border-link pl-4 my-4 italic text-muted">
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
        <code className="bg-code-bg text-code-foreground text-sm px-1.5 py-0.5 rounded font-mono">
          {children}
        </code>
      );
    }
    return <code className={className}>{children}</code>;
  },
  pre: ({ children }: ComponentPropsWithoutRef<"pre">) => (
    <pre className="bg-code-bg text-code-foreground rounded-lg overflow-x-auto my-6 p-4 text-sm">
      {children}
    </pre>
  ),
  table: ({ children }: ComponentPropsWithoutRef<"table">) => (
    <div className="overflow-x-auto my-6">
      <table className="min-w-full border border-border rounded-lg overflow-hidden">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: ComponentPropsWithoutRef<"thead">) => (
    <thead className="bg-card-bg">{children}</thead>
  ),
  th: ({ children }: ComponentPropsWithoutRef<"th">) => (
    <th className="text-left px-4 py-3 text-sm font-semibold text-foreground">
      {children}
    </th>
  ),
  td: ({ children }: ComponentPropsWithoutRef<"td">) => (
    <td className="px-4 py-3 text-sm text-muted border-t border-border">
      {children}
    </td>
  ),
  hr: () => <hr className="my-8 border-border" />,
  strong: ({ children }: ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-semibold text-foreground">
      {children}
    </strong>
  ),
};

