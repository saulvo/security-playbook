import Link from 'next/link';

const categories = [
  { slug: 'authentication', name: 'Authentication' },
  { slug: 'authorization', name: 'Authorization' },
  { slug: 'encryption', name: 'Encryption' },
  { slug: 'web-chat-security', name: 'Web Chat Security' },
  { slug: 'xss-csrf-csp', name: 'XSS, CSRF & CSP' },
  { slug: 'security-scanning', name: 'Security Scanning' },
  { slug: 'checklists', name: 'Checklists' },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="max-w-5xl mx-auto w-full px-6 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Security Playbook
            </h3>
            <p className="text-sm text-muted">
              A comprehensive guide to frontend security best practices.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Categories
            </h3>
            <ul className="space-y-2">
              {categories.map((cat) => (
                <li key={cat.slug}>
                  <Link
                    href={`/${cat.slug}`}
                    className="text-sm text-muted hover:text-link transition-colors"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Resources
            </h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://owasp.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted hover:text-link transition-colors"
                >
                  OWASP
                </a>
              </li>
              <li>
                <a
                  href="https://cheatsheetseries.owasp.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted hover:text-link transition-colors"
                >
                  OWASP Cheat Sheets
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border">
          <p className="text-sm text-muted text-center">
            © {new Date().getFullYear()} <a href="https://saulvo.vercel.app/" target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-foreground transition-colors">Saul Vo</a>. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
