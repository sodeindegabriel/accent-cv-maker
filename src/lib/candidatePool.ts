import { supabase } from "@/lib/supabaseClient";

export type CandidatePoolEntry = {
  email: string;
  name: string;
  phone: string | null;
  jobTypes: string[];
  language: string;
  rightToWork: string;
  city: string;
  postcode: string | null;
  skills: string[];
  availability: string[];
  referralSource: string | null;
  timestamp: string;
};

export type SupabaseCandidateInsert = CandidatePoolEntry & {
  userId: string | null;
  cvDocumentId: string | null;
  cvEnglish: { html: string } | null;
  cvNative: { html: string } | null;
};

const STORAGE_KEY = "cvlingo:candidatePool";
const SUBMITTED_FLAG = "cvlingo:candidatePoolSubmitted";

export function getCandidatePool(): CandidatePoolEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CandidatePoolEntry[]) : [];
  } catch {
    return [];
  }
}

export function addCandidate(entry: CandidatePoolEntry) {
  if (typeof window === "undefined") return;
  const all = getCandidatePool();
  all.push(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  sessionStorage.setItem(SUBMITTED_FLAG, "1");
}

export function hasSubmittedThisSession(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(SUBMITTED_FLAG) === "1";
}

export async function insertCandidateToSupabase(entry: SupabaseCandidateInsert): Promise<void> {
  const { error } = await supabase.from("candidates").insert({
    user_id: entry.userId || null,
    name: entry.name,
    email: entry.email,
    phone: entry.phone || null,
    city: entry.city,
    postcode: entry.postcode || null,
    right_to_work: entry.rightToWork,
    language: entry.language,
    job_types: entry.jobTypes,
    skills: entry.skills,
    availability: entry.availability,
    cv_english: entry.cvEnglish,
    cv_native: entry.cvNative,
    cv_document_id: entry.cvDocumentId || null,
    referral_source: entry.referralSource || null,
  });
  if (error) {
    console.error("[insertCandidateToSupabase] error:", error);
  }
}

export function isValidEmail(email: string): boolean {
  const e = (email ?? "").trim();
  if (e.length < 6) return false;
  if (/\s/.test(e)) return false;
  if (e.startsWith("@")) return false;
  if (/^www\./i.test(e)) return false;
  if (e.includes("..")) return false;
  const at = e.indexOf("@");
  if (at <= 0 || at !== e.lastIndexOf("@")) return false;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (!local || !domain) return false;
  if (domain.startsWith(".") || domain.endsWith(".")) return false;
  if (!domain.includes(".")) return false;
  const tld = domain.split(".").pop() ?? "";
  if (tld.length < 2) return false;
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(e)) return false;
  const lower = e.toLowerCase();
  const fakes = new Set(["test@test.com", "a@a.com", "123@123.com", "test@test.co.uk"]);
  if (fakes.has(lower)) return false;
  if (/^test@test\./i.test(lower)) return false;
  if (/^([a-z0-9])\1*@\1+\./i.test(lower)) return false;
  return true;
}

export function toCSV(entries: CandidatePoolEntry[]): string {
  const headers = [
    "timestamp", "email", "name", "phone",
    "jobTypes", "language", "rightToWork",
    "city", "postcode", "skills", "availability", "referralSource",
  ];
  const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const rows = entries.map((e) =>
    [
      e.timestamp,
      e.email,
      e.name,
      e.phone ?? "",
      e.jobTypes.join("; "),
      e.language,
      e.rightToWork,
      e.city,
      e.postcode ?? "",
      (e.skills ?? []).join("; "),
      (e.availability ?? []).join("; "),
      e.referralSource ?? "",
    ]
      .map((v) => escape(String(v)))
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}
