export function GeneratingOverlay() {
  const messages = [
    "Reading your experience...",
    "Writing your personal statement...",
    "Formatting your CV...",
    "Almost ready...",
  ];

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-primary/80 backdrop-blur-sm text-primary-foreground"
    >
      <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary-foreground/30 border-t-primary-foreground" />
      <RotatingMessage messages={messages} />
    </div>
  );
}

import { useEffect, useState } from "react";

function RotatingMessage({ messages }: { messages: string[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % messages.length), 2000);
    return () => clearInterval(id);
  }, [messages.length]);
  return <p className="text-lg font-medium">{messages[index]}</p>;
}
