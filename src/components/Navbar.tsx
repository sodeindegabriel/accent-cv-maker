import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";


export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleAnchor = (e: React.MouseEvent, hash: string) => {
    e.preventDefault();
    setOpen(false);
    if (location.pathname === "/") {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `/#${hash}`);
    } else {
      navigate({ to: "/", hash });
    }
  };

  const links = [
    { label: "How it works", hash: "how" },
    { label: "For Community", to: "/partners" as const },
    { label: "Languages", hash: "languages" },
    { label: "For Employers", to: "/employer" as const },
  ];

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all ${
        scrolled ? "bg-white/90 backdrop-blur border-b border-border" : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link to="/" className="flex items-center gap-2 text-primary">
          <img src="/cvlingo-logo.svg" alt="CVLingo" className="h-10 w-10 rounded-full" />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) =>
            l.to ? (
              <Link
                key={l.label}
                to={l.to}
                className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors"
              >
                {l.label}
              </Link>
            ) : (
              <a
                key={l.label}
                href={`/#${l.hash}`}
                onClick={(e) => handleAnchor(e, l.hash!)}
                className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors"
              >
                {l.label}
              </a>
            )
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.removeItem("cvlingo:preselectLanguage");
              sessionStorage.removeItem("selectedLanguage");
              sessionStorage.removeItem("preselectLanguage");
              localStorage.removeItem("cvlingo_form_data");
            } catch { /* ignore */ }
            navigate({ to: "/build" });
          }}
          className="hidden md:inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
        >
          Build My CV Free
        </button>

        <button
          aria-label="Toggle menu"
          className="md:hidden text-foreground"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile drawer */}
      <div
        className={`md:hidden overflow-hidden transition-[max-height] duration-300 ${
          open ? "max-h-96 border-b border-border bg-white" : "max-h-0"
        }`}
      >
        <div className="flex flex-col gap-1 px-5 py-3">
          {links.map((l) =>
            l.to ? (
              <Link
                key={l.label}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-foreground hover:bg-secondary"
              >
                {l.label}
              </Link>
            ) : (
              <a
                key={l.label}
                href={`/#${l.hash}`}
                onClick={(e) => handleAnchor(e, l.hash!)}
                className="rounded-lg px-3 py-3 text-base font-medium text-foreground hover:bg-secondary"
              >
                {l.label}
              </a>
            )
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              try {
                sessionStorage.removeItem("cvlingo:preselectLanguage");
                sessionStorage.removeItem("selectedLanguage");
                sessionStorage.removeItem("preselectLanguage");
                localStorage.removeItem("cvlingo_form_data");
              } catch { /* ignore */ }
              navigate({ to: "/build" });
            }}
            className="mt-2 inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Build My CV Free
          </button>
        </div>
      </div>
    </header>
  );
}
