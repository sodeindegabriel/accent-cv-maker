import { type ReactNode, useEffect, useRef } from "react";

/**
 * Renders a mailto link whose address is assembled client-side so it is
 * absent from static HTML/SSR output, reducing bot harvesting.
 *
 * - Without children: displays the email address as the link text.
 * - With children: displays children as the link text (address only in href).
 */
export function ObfuscatedEmail({
  className,
  subject,
  children,
}: {
  className?: string;
  subject?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const addr = ["hello", "cvlingo.com"].join("@");
    ref.current.href = subject
      ? `mailto:${addr}?subject=${encodeURIComponent(subject)}`
      : `mailto:${addr}`;
    if (!children) {
      ref.current.textContent = addr;
    }
  }, []);

  return (
    <a ref={ref} className={className}>
      {children}
    </a>
  );
}
