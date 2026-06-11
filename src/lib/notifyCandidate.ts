import emailjs from "@emailjs/browser";
import type { CandidatePoolEntry } from "./candidatePool";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined;
const TO_EMAIL = "cvlingouk@gmail.com";

export async function notifyCandidate(entry: CandidatePoolEntry): Promise<void> {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.warn("[notifyCandidate] EmailJS env vars missing — skipping email send");
    return;
  }

  const subject = `New CVLingo Candidate — ${entry.name || "Unknown"}`;
  const message = [
    `Name: ${entry.name}`,
    `Email: ${entry.email}`,
    `Job Types: ${entry.jobTypes.join(", ")}`,
    `Language: ${entry.language}`,
    `Right to Work: ${entry.rightToWork}`,
    `City: ${entry.city}`,
    `Postcode: ${entry.postcode ?? ""}`,
    `Referral: ${entry.referralSource ?? ""}`,
    `Time: ${entry.timestamp}`,
  ].join("\n");

  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        to_email: TO_EMAIL,
        subject,
        message,
        name: entry.name,
        email: entry.email,
        job_types: entry.jobTypes.join(", "),
        language: entry.language,
        right_to_work: entry.rightToWork,
        city: entry.city,
        postcode: entry.postcode ?? "",
        referral: entry.referralSource ?? "",
        timestamp: entry.timestamp,
      },
      { publicKey: PUBLIC_KEY },
    );
  } catch (err) {
    console.error("[notifyCandidate] EmailJS send failed", err);
  }
}
