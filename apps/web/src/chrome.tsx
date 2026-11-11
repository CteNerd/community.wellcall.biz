import { brand } from "./branding.ts";

export type SitePage = "home" | "pathways" | "experience";

type NavItem = { id: string; label: string; kind: "page" | "anchor" };

/**
 * The main nav only lists Mission, Pathways and Experience — the site's
 * three top-level pillars. Participate, Collaborators, Readiness and FAQ are
 * supporting sections on the home page, not destinations in their own
 * right, so they're reached by scrolling, in-page links (hero CTA, header
 * status pill, pathways teaser) or the footer, not the main nav.
 */
const navItems: NavItem[] = [
  { id: "mission", label: "Mission", kind: "anchor" },
  { id: "pathways", label: "Pathways", kind: "page" },
  { id: "experience", label: "Experience", kind: "page" },
];

/**
 * Anchors (currently just "mission") only exist on the home page; from
 * another page they need an absolute "/#id" link. Pathways and experience
 * are their own routes everywhere.
 */
function hrefFor(item: NavItem, page: SitePage) {
  if (item.kind === "page") return `/${item.id}`;
  return page === "home" ? `#${item.id}` : `/#${item.id}`;
}

export function SectionLabel({ children }: { children: string }) {
  return <p className="section-label">{children}</p>;
}

/**
 * Client-rendered pages have no server-provided markup for the browser to
 * scroll to at initial parse time, so native "#id" fragment navigation is
 * unreliable here. Call this on mount (after the target exists in the DOM)
 * instead of depending on the browser's own anchor scrolling.
 */
export function scrollToHash(hash: string) {
  if (!hash) return;
  document.getElementById(hash.slice(1))?.scrollIntoView?.();
}

export function StatusChip({ tone, children }: { tone: "planned" | "future"; children: string }) {
  return (
    <span className={`status-chip status-chip-${tone}`}>
      <span className="status-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

export function SkipLink() {
  return (
    <a className="skip-link" href="#main">
      Skip to content
    </a>
  );
}

export function PreviewBanner({ production }: { production: boolean }) {
  return (
    <div className="preview-banner">
      <span className="status-dot" aria-hidden="true" />
      {production ? "CUT BLOCK" : "Development preview"}
    </div>
  );
}

export function SiteHeader({ page }: { page: SitePage }) {
  const homeHref = page === "home" ? "#top" : "/";
  return (
    <header className="site-header">
      <a className="brand-lockup" href={homeHref} aria-label={`${brand.shortName} home`}>
        <span className="brand-mark" aria-hidden="true">
          <span />
          <span />
        </span>
        <span className="brand-type">
          <strong>{brand.shortName}</strong>
          <span>{brand.productName.replace(`${brand.shortName} `, "").toUpperCase()}</span>
        </span>
      </a>
      <nav className="main-nav" aria-label="Main navigation">
        {navItems.map((item) => (
          <a key={item.id} href={hrefFor(item, page)}>{item.label}</a>
        ))}
      </nav>
      <a className="header-status" href={page === "home" ? "#readiness" : "/#readiness"}>
        Pilot readiness <span aria-hidden="true">↗</span>
      </a>
    </header>
  );
}

export function SiteFooter({ page, production }: { page: SitePage; production: boolean }) {
  const homeHref = page === "home" ? "#top" : "/";
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <a className="brand-lockup footer-brand" href={homeHref} aria-label={`${brand.shortName} home`}>
          <span className="brand-mark" aria-hidden="true"><span /><span /></span>
          <span className="brand-type">
            <strong>{brand.shortName}</strong>
            <span>{brand.productName.replace(`${brand.shortName} `, "").toUpperCase()}</span>
          </span>
        </a>
        <p>Build with purpose, in the office and on the field.</p>
        {production && <p>Business line: <a href="tel:+12816927522">281-692-7522</a></p>}
        <a className="footer-top" href={homeHref}>{page === "home" ? "Back to top ↑" : "Back to home ↑"}</a>
      </div>
      <div className="footer-bottom">
        <span>{production ? brand.productName : `Development preview · ${brand.status} working brand`}</span>
        <span>Adult pilot planned · Field training not open · Enrollment closed.</span>
      </div>
    </footer>
  );
}
