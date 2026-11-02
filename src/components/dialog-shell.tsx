import { useEffect, useRef } from "react";

// Accessible modal shell: Escape / backdrop-click / × to close, focus trap, focus restore.
// Pass `busy` while an action is in flight to block accidental dismissal.
// Put `autoFocus` on the safe (non-destructive) button inside so keyboard users land there.
export function DialogShell({
  children,
  onClose,
  busy = false,
  maxWidth = "max-w-sm",
}: {
  children: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
  maxWidth?: string;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    prevFocusRef.current = document.activeElement as HTMLElement;
    return () => { prevFocusRef.current?.focus(); };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  useEffect(() => {
    function onTab(e: KeyboardEvent) {
      if (e.key !== "Tab" || !panelRef.current) return;
      const els = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
        )
      );
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
    document.addEventListener("keydown", onTab);
    return () => document.removeEventListener("keydown", onTab);
  }, []);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onMouseDown={(e) => { if (!busy && e.target === overlayRef.current) onClose(); }}
    >
      <div ref={panelRef} className={`bg-white rounded-2xl shadow-xl w-full ${maxWidth} p-6 relative`}>
        <button
          type="button"
          onClick={() => !busy && onClose()}
          disabled={busy}
          aria-label="Close"
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground text-xl leading-none rounded-full w-8 h-8 flex items-center justify-center hover:bg-muted disabled:opacity-30"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
