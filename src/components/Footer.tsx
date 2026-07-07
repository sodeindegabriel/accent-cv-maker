import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

function FooterAnchor({ hash, children }: { hash: string; children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === "/") {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `/#${hash}`);
    } else {
      navigate({ to: "/", hash });
    }
  };
  return (
    <a href={`/#${hash}`} onClick={onClick} className="hover:text-accent transition-colors">
      {children}
    </a>
  );
}

export function Footer() {
  return (
    <footer className="bg-footer text-footer-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2 text-white">
            <img src="/cvlingo-logo.svg" alt="CVLingo" className="h-12 w-12 rounded-full" />
          </div>
          <p className="mt-4 text-sm text-white/70">Bridging talent with opportunity.</p>
          <p className="mt-3 text-sm font-semibold text-accent">Free for jobseekers. Always.</p>
        </div>

        <div>
          <h4 className="font-sans text-sm font-semibold uppercase tracking-wider text-white/90">Platform</h4>
          <ul className="mt-4 space-y-3 text-sm text-white/70">
            <li><FooterAnchor hash="languages">Build Your CV</FooterAnchor></li>
            <li><FooterAnchor hash="how">How It Works</FooterAnchor></li>
            <li><FooterAnchor hash="watch">Watch Demo</FooterAnchor></li>
            <li><FooterAnchor hash="languages">Languages</FooterAnchor></li>
          </ul>
        </div>

        <div>
          <h4 className="font-sans text-sm font-semibold uppercase tracking-wider text-white/90">Company</h4>
          <ul className="mt-4 space-y-3 text-sm text-white/70">
            <li><Link to="/employer" className="hover:text-accent transition-colors">For Employers</Link></li>
            <li><Link to="/partners" className="hover:text-accent transition-colors">Community Partners</Link></li>
            <li><Link to="/privacy" className="hover:text-accent transition-colors">Privacy Policy</Link></li>
            <li><Link to="/terms" className="hover:text-accent transition-colors">Terms of Service</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-white/50 md:flex-row md:items-center md:justify-between">
          <div>
            <span>© 2026 CVLingo. Built for UK immigrants. </span>
            <a
              href="https://jebacoglobal.com"
              target="_blank"
              rel="noreferrer"
              className="text-accent transition-colors hover:text-accent/80"
            >
              Built by Jebaco Global
            </a>
          </div>
          <a href="mailto:hello@cvlingo.com" className="transition-colors hover:text-accent">
            hello@cvlingo.com
          </a>
        </div>
      </div>
    </footer>
  );
}
