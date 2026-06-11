export type CandidatePoolEntry = {
  email: string;
  name: string;
  jobTypes: string[];
  language: string;
  rightToWork: string;
  city: string;
  referralSource: string | null;
  timestamp: string;
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

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function toCSV(entries: CandidatePoolEntry[]): string {
  const headers = [
    "timestamp",
    "email",
    "name",
    "jobTypes",
    "language",
    "rightToWork",
    "city",
    "referralSource",
  ];
  const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const rows = entries.map((e) =>
    [
      e.timestamp,
      e.email,
      e.name,
      e.jobTypes.join("; "),
      e.language,
      e.rightToWork,
      e.city,
      e.referralSource ?? "",
    ]
      .map((v) => escape(String(v)))
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}
