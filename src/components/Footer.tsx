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

function BridgeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path d="M3 22c4-6 9-9 13-9s9 3 13 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M3 22h26" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M8 22v-5M14 22v-7M18 22v-7M24 22v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="bg-footer text-footer-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2 text-white">
            <BridgeIcon className="h-7 w-7" />
            <span className="font-serif text-2xl">CVLingo</span>
          </div>
          <p className="mt-4 text-sm text-white/70">Bridging talent with opportunity.</p>
          <p className="mt-3 text-sm font-semibold text-accent">Free for jobseekers. Always.</p>
        </div>

        <div>
          <h4 className="font-sans text-sm font-semibold uppercase tracking-wider text-white/90">Platform</h4>
          <ul className="mt-4 space-y-3 text-sm text-white/70">
            <li><Link to="/build" className="hover:text-accent transition-colors">Build Your CV</Link></li>
            <li><FooterAnchor hash="how">How It Works</FooterAnchor></li>
            <li><FooterAnchor hash="languages">Languages</FooterAnchor></li>
            <li><Link to="/employer" className="hover:text-accent transition-colors">For Employers</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-sans text-sm font-semibold uppercase tracking-wider text-white/90">Company</h4>
          <ul className="mt-4 space-y-3 text-sm text-white/70">
            <li><a href="#" className="hover:text-accent transition-colors">Privacy Policy</a></li>
            <li><a href="#" className="hover:text-accent transition-colors">Terms of Service</a></li>
            <li><a href="#" className="hover:text-accent transition-colors">Contact</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-white/50 md:flex-row md:items-center md:justify-between">
          <span>© 2026 CVLingo. Built for UK immigrants.</span>
          <a href="https://jebacoglobal.com/" target="_blank" rel="noreferrer" className="text-accent transition-colors hover:text-accent/80">
            Built by Jebaco Global
          </a>
        </div>
      </div>
    </footer>
  );
}
