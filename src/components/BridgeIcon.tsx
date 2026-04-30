export function BridgeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path
        d="M3 22c4-6 9-9 13-9s9 3 13 9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M3 22h26" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M8 22v-5M14 22v-7M18 22v-7M24 22v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
