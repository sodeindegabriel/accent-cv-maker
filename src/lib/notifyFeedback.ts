import emailjs from "@emailjs/browser";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined;

export async function notifyFeedback(
  rating: number | null,
  comment: string | null,
  userEmail?: string,
): Promise<void> {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.warn("[notifyFeedback] EmailJS env vars missing — skipping");
    return;
  }
  const stars = rating ? "★".repeat(rating) + "☆".repeat(5 - rating) : "—";
  const message = [
    `Rating: ${stars} (${rating ?? "none"}/5)`,
    `Comment: ${comment || "No comment"}`,
    `User: ${userEmail || "anonymous"}`,
  ].join("\n");
  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        to_email: "hello@cvlingo.com",
        subject: `New CVLingo Feedback — ${stars}`,
        message,
        name: "CVLingo Feedback",
        email: userEmail || "no-reply@cvlingo.com",
      },
      { publicKey: PUBLIC_KEY },
    );
  } catch (err) {
    console.error("[notifyFeedback] email failed", err);
  }
}
