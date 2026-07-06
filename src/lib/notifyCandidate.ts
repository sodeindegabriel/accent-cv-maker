import emailjs from "@emailjs/browser";
import type { CandidatePoolEntry } from "./candidatePool";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined;
const TO_EMAIL = "hello@cvlingo.com";

export async function notifyCandidate(entry: CandidatePoolEntry): Promise<void> {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.warn("[notifyCandidate] EmailJS env vars missing — skipping email send");
    return;
  }

  // Admin notification
  const adminSubject = `New CVLingo Candidate — ${entry.name || "Unknown"}`;
  const adminMessage = [
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
        subject: adminSubject,
        message: adminMessage,
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
    console.error("[notifyCandidate] admin email failed", err);
  }

  // Candidate auto-reply confirmation
  const jobTypesList = entry.jobTypes.join(", ") || "your chosen";
  const autoReplyMessage = [
    `Hi ${entry.name},`,
    "",
    `Great news — your CV profile has been added to the CVLingo candidate pool.`,
    "",
    `Employers hiring for ${jobTypesList} roles in the UK can now find your profile and reach out to you directly.`,
    "",
    `What happens next:`,
    `- Employers browsing our candidate pool may contact you about relevant roles`,
    `- Your information is private and secure`,
    `- You can request removal at any time by emailing hello@cvlingo.com`,
    "",
    `Good luck with your job search!`,
    "",
    `The CVLingo Team`,
    `cvlingo.com`,
  ].join("\n");

  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        to_email: entry.email,
        subject: "Your CV is in our candidate pool — CVLingo",
        message: autoReplyMessage,
        name: entry.name,
        email: entry.email,
      },
      { publicKey: PUBLIC_KEY },
    );
  } catch (err) {
    console.error("[notifyCandidate] auto-reply failed", err);
  }
}
