import "flag-icons/css/flag-icons.min.css";

// Maps CVLingo language code → ISO 3166-1 alpha-2 country code (lowercase)
const LANG_TO_COUNTRY: Record<string, string> = {
  en: "gb",
  pl: "pl",
  ro: "ro",
  pa: "in",
  ur: "pk",
  pt: "pt",
  es: "es",
  ar: "sa",
  bn: "bd",
  gu: "in",
  fr: "fr",
  tr: "tr",
  hi: "in",
  so: "so",
  zh: "cn",
  fa: "ir",
  uk: "ua",
  ku: "xk",
  ta: "lk",
  am: "et",
  ti: "er",
};

export function langToCountry(langCode: string): string {
  return LANG_TO_COUNTRY[langCode] ?? "un";
}

interface FlagIconProps {
  countryCode: string;
  /** font-size controlling the rendered size; flag-icons uses 1em height, 1.333em width */
  size?: string;
  className?: string;
}

export function FlagIcon({ countryCode, size = "1.5rem", className = "" }: FlagIconProps) {
  return (
    <span
      className={`fi fi-${countryCode.toLowerCase()}${className ? ` ${className}` : ""}`}
      style={{ fontSize: size }}
      aria-hidden="true"
    />
  );
}
