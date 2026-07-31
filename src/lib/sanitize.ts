import DOMPurify from "dompurify";

// Allowlist: basic CV formatting only — no scripts, iframes, forms, or event handlers.
const CV_ALLOWED_TAGS = [
  "p", "br", "strong", "em", "b", "i", "u", "s",
  "ul", "ol", "li",
  "h1", "h2", "h3", "h4",
  "span", "div", "section",
  "table", "thead", "tbody", "tr", "th", "td",
  "hr",
];

const CV_ALLOWED_ATTR = ["class", "style", "dir", "lang"];

export function sanitizeCvHtml(input: string): string {
  if (!input) return "";

  let s = input.replace(/\r\n/g, "\n").trim();
  // Strip code fences if the model wrapped output in a markdown block
  s = s.replace(/^```(?:html|HTML)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  // Normalize markdown bold before sanitizing so it renders correctly
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  if (typeof window === "undefined") {
    // SSR: DOMPurify requires a DOM environment. Strip all tags as a safe fallback.
    return s.replace(/<[^>]+>/g, "").trim();
  }

  return DOMPurify.sanitize(s, {
    ALLOWED_TAGS: CV_ALLOWED_TAGS,
    ALLOWED_ATTR: CV_ALLOWED_ATTR,
    FORBID_CONTENTS: ["script", "style", "noscript", "iframe", "object", "embed", "form"],
  });
}
