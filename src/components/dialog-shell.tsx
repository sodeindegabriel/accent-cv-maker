import { useEffect, useRef, useState } from "react";

// Accessible modal shell: Escape / backdrop-click / × to close, focus trap, focus restore.
// Pass `busy` while an action is in flight to block accidental dismissal.
// Pass `dirty` when the form has unsaved edits — close attempts show an inline
// "Discard your changes?" confirm instead of closing immediately.
// Pass `required` to block ALL close mechanisms (Escape, backdrop, ×) — only the
// dialog's own buttons can close it. Use for mandatory age/consent flows.
// Put `autoFocus` on the safe (non-destructive) button inside so keyboard users land there.
export function DialogShell({
  children,
  onClose,
  busy = false,
  dirty = false,
  required = false,
  maxWidth = "max-w-sm",
}: {
  children: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
  dirty?: boolean;
  required?: boolean;
  maxWidth?: string;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    prevFocusRef.current = document.activeElement as HTMLElement;
    return () => { prevFocusRef.current?.focus(); };
  }, []);

  // Focus "Keep editing" when the discard confirm appears
  useEffect(() => {
    if (confirmDiscard) keepEditingRef.current?.focus();
  }, [confirmDiscard]);

  function tryClose() {
    if (required) return;
    if (busy) return;
    if (dirty) { setConfirmDiscard(true); return; }
    onClose();
  }

  // Escape: dismiss the discard confirm first; then guard dirty; then close.
  // Use capture so this fires before any child Escape handler.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (required) return;
      if (e.key !== "Escape" || busy) return;
      if (confirmDiscard) { e.stopPropagation(); setConfirmDiscard(false); return; }
      if (dirty) { setConfirmDiscard(true); return; }
      onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [busy, dirty, required, confirmDiscard, onClose]);

  // Tab trap: keep focus cycling inside the panel
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
      onMouseDown={(e) => { if (!required && e.target === overlayRef.current) tryClose(); }}
    >
      <div ref={panelRef} className={`bg-white rounded-2xl shadow-xl w-full ${maxWidth} p-6 relative`}>
        {!required && (
          <button
            type="button"
            onClick={tryClose}
            disabled={busy}
            aria-label="Close"
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground text-xl leading-none rounded-full w-8 h-8 flex items-center justify-center hover:bg-muted disabled:opacity-30"
          >
            ×
          </button>
        )}
        {children}
        {confirmDiscard && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/95 p-6 text-center">
            <p className="font-semibold text-foreground mb-1">Discard your changes?</p>
            <p className="text-sm text-muted-foreground mb-5">Your unsaved edits will be lost.</p>
            <div className="flex gap-3 w-full">
              <button
                ref={keepEditingRef}
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="flex-1 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted min-h-[44px]"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => { setConfirmDiscard(false); onClose(); }}
                className="flex-1 rounded-xl bg-destructive px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 min-h-[44px]"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
