// Shared components and helpers for all partner screens
import { useEffect, useRef, useState } from "react";
import emailjs from "@emailjs/browser";
import { jsPDF } from "jspdf";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "@/lib/supabaseClient";
import { sanitizeCvHtml } from "@/lib/sanitize";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  as string | undefined;

// ── Types ──────────────────────────────────────────────────────────────────────
export interface PartnerPageClient {
  client_ref: string;
  display_name: string;
  language: string;
  job_types: string[] | null;
  cover_letter_count: number | null;
  joined_at: string;
  has_cv: boolean;
  shared: boolean;
  scope: string | null;
  mentor_user_id: string | null;
  mentor_name: string | null;
  case_status: "active" | "closed";
  closed_at: string | null;
  outcome: string | null;
}

export interface TeamMember {
  member_id: string;
  member_user_id: string | null;
  name: string;
  email: string;
  role: string;
  created_at: string;
  status: "active" | "invited";
  assigned_count: number;
  closed_count: number;
}

export interface PartnerNotification {
  id: string;
  kind: string;
  actor_user_id: string | null;
  client_user_id: string | null;
  message: string;
  created_at: string;
}

export interface PartnerCoverLetter {
  id: string;
  job_title: string | null;
  company: string | null;
  language: string;
  english_text: string;
  native_text: string;
  created_at: string;
}

export const CASE_OUTCOMES = [
  { value: "employment",              label: "Employment found" },
  { value: "training",                label: "Training or education" },
  { value: "volunteering",            label: "Volunteering" },
  { value: "no_longer_needs_support", label: "No longer needs support" },
  { value: "moved_or_no_contact",     label: "Moved or no contact" },
  { value: "other",                   label: "Other" },
] as const;

export const PAGE_SIZE_DEFAULT = 25;
export const RTL_LANGS = new Set(["Arabic", "Urdu", "Persian", "Kurdish", "Farsi"]);

// ── Helpers ────────────────────────────────────────────────────────────────────
export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function currentMonthLabel() {
  return new Date().toLocaleString("en-GB", { month: "long", year: "numeric" });
}

export function outcomeLabel(v: string | null) {
  return CASE_OUTCOMES.find(o => o.value === v)?.label ?? v ?? "";
}

export function roleLabel(role: string): string {
  return role === "owner" || role === "manager" ? "Manager" : "Mentor";
}

export async function sendTeamInviteEmail(partnerName: string, inviteeEmail: string) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) return;
  const message = [
    `You've been added as a team member on ${partnerName}'s CVLingo partner dashboard.`,
    "",
    "To access the dashboard:",
    "1. Go to cvlingo.com and click Log in.",
    "2. Enter this email address to receive a one-time login code.",
    "3. You can set a password later from your dashboard if you prefer.",
    "",
    "The CVLingo team",
  ].join("\n");
  await emailjs.send(
    SERVICE_ID, TEMPLATE_ID,
    { to_email: inviteeEmail, subject: `You've been invited to join ${partnerName}'s CVLingo team`, message, name: partnerName },
    { publicKey: PUBLIC_KEY },
  );
}

// ── PDF/Word export ────────────────────────────────────────────────────────────
export function downloadCvPdf(htmlContent: string, displayName: string) {
  const safeName = displayName.replace(/[^\w\s-]/g, "").trim();
  const el = document.createElement("div");
  el.innerHTML = sanitizeCvHtml(htmlContent);
  el.style.cssText = "position:absolute;visibility:hidden;left:-9999px;top:-9999px;";
  document.body.appendChild(el);
  try {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210, ML = 18, MR = 18, CW = W - ML - MR;
    let y = 22;
    const np = (h: number) => { if (y + h > 282) { pdf.addPage(); y = 18; } };
    const cvName = el.querySelector(".cv-name")?.textContent?.trim() ?? displayName;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(26); pdf.setTextColor(26, 26, 26);
    pdf.splitTextToSize(cvName, CW).forEach((l: string) => { pdf.text(l, W / 2, y, { align: "center" }); y += 10; });
    y += 3;
    const cvContact = el.querySelector(".cv-contact")?.textContent?.trim() ?? "";
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(107, 114, 128);
    pdf.splitTextToSize(cvContact, CW).forEach((l: string) => { pdf.text(l, W / 2, y, { align: "center" }); y += 6; });
    y += 8;
    el.querySelectorAll(".cv-section").forEach((section) => {
      np(14); pdf.setDrawColor(220, 220, 220); pdf.line(ML, y, W - MR, y); y += 5;
      const heading = section.querySelector("h2")?.textContent?.trim() ?? "";
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(13, 110, 110);
      pdf.text(heading, ML, y); y += 6;
      section.querySelectorAll("p").forEach((p) => {
        if (p.closest(".cv-job") || p.closest(".cv-edu")) return;
        const txt = p.textContent?.trim() ?? ""; if (!txt) return;
        np(6); pdf.setFont("helvetica", "normal"); pdf.setFontSize(11); pdf.setTextColor(26, 26, 26);
        pdf.splitTextToSize(txt, CW).forEach((l: string) => { np(6); pdf.text(l, ML, y); y += 6; }); y += 3;
      });
      section.querySelectorAll(".cv-job").forEach((job) => {
        np(8);
        const jobP = job.querySelector("p");
        if (jobP) {
          const t = jobP.querySelector("strong")?.textContent?.trim() ?? "";
          const d = jobP.querySelector(".cv-date")?.textContent?.trim() ?? "";
          let c = ""; jobP.childNodes.forEach((n) => { if (n.nodeType === Node.TEXT_NODE) c += n.textContent ?? ""; }); c = c.trim();
          pdf.setFontSize(11); pdf.setFont("helvetica", "bold"); pdf.setTextColor(26, 26, 26);
          pdf.text(t, ML, y); pdf.setFont("helvetica", "normal");
          if (c) pdf.text(c, ML + pdf.getTextWidth(t + " "), y);
          if (d) { pdf.setTextColor(107, 114, 128); pdf.text(d, W - MR, y, { align: "right" }); pdf.setTextColor(26, 26, 26); }
          y += 6;
        }
        job.querySelectorAll("li").forEach((li) => {
          const txt = li.textContent?.trim() ?? ""; if (!txt) return;
          np(6); pdf.setFont("helvetica", "normal"); pdf.setFontSize(11); pdf.setTextColor(26, 26, 26);
          pdf.text("•", ML + 1, y);
          pdf.splitTextToSize(txt, CW - 5).forEach((l: string) => { np(6); pdf.text(l, ML + 5, y); y += 6; });
        });
        y += 2;
      });
      section.querySelectorAll(".cv-edu").forEach((edu) => {
        np(8);
        const eduP = edu.querySelector("p");
        if (eduP) {
          const q = eduP.querySelector("strong")?.textContent?.trim() ?? "";
          const d = eduP.querySelector(".cv-date")?.textContent?.trim() ?? "";
          let inst = ""; eduP.childNodes.forEach((n) => { if (n.nodeType === Node.TEXT_NODE) inst += n.textContent ?? ""; }); inst = inst.trim();
          pdf.setFontSize(11); pdf.setFont("helvetica", "bold"); pdf.setTextColor(26, 26, 26);
          pdf.text(q, ML, y);
          if (d) { pdf.setTextColor(107, 114, 128); pdf.text(d, W - MR, y, { align: "right" }); }
          y += 6;
          if (inst) { pdf.setFont("helvetica", "normal"); pdf.setTextColor(107, 114, 128); pdf.text(inst, ML, y); y += 6; }
        }
        y += 1;
      });
      section.querySelectorAll("ul > li").forEach((li) => {
        if (li.closest(".cv-job") || li.closest(".cv-edu")) return;
        const se = li.querySelector("strong"); np(6); pdf.setFontSize(11); pdf.setTextColor(26, 26, 26);
        if (se) {
          const lb = se.textContent?.trim() ?? "";
          let desc = ""; li.childNodes.forEach((n) => { if (n !== se && n.nodeType === Node.TEXT_NODE) desc += n.textContent ?? ""; }); desc = desc.trim();
          pdf.setFont("helvetica", "bold"); pdf.text("• " + lb, ML + 1, y); y += 6;
          if (desc) { pdf.setFont("helvetica", "normal"); pdf.splitTextToSize(desc, CW - 5).forEach((l: string) => { np(6); pdf.text(l, ML + 5, y); y += 6; }); }
          y += 2;
        } else {
          const txt = li.textContent?.trim() ?? ""; if (!txt) return;
          pdf.setFont("helvetica", "normal"); pdf.text("•", ML + 1, y);
          pdf.splitTextToSize(txt, CW - 5).forEach((l: string) => { np(6); pdf.text(l, ML + 5, y); y += 6; }); y += 1;
        }
      });
      y += 4;
    });
    pdf.save(`${safeName} - CVLingo.pdf`);
  } finally { document.body.removeChild(el); }
}

export async function downloadCvDocx(htmlContent: string, displayName: string) {
  const { Document, Packer, Paragraph, TextRun, BorderStyle, AlignmentType } = await import("docx");
  const el = document.createElement("div");
  el.innerHTML = sanitizeCvHtml(htmlContent);
  type DP = InstanceType<typeof Paragraph>;
  const children: DP[] = [];
  const cvName = el.querySelector(".cv-name")?.textContent?.trim() ?? displayName;
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: cvName, bold: true, size: 52, font: "Calibri" })], spacing: { after: 120 } }));
  const cvContact = el.querySelector(".cv-contact")?.textContent?.trim() ?? "";
  if (cvContact) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: cvContact, size: 20, color: "6B7280", font: "Calibri" })], spacing: { after: 280 } }));
  el.querySelectorAll(".cv-section").forEach((section) => {
    const heading = section.querySelector("h2")?.textContent?.trim() ?? "";
    children.push(new Paragraph({ border: { bottom: { color: "DCDCDC", style: BorderStyle.SINGLE, size: 6 } }, children: [], spacing: { before: 240, after: 120 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: heading, bold: true, size: 26, color: "0D6E6E", font: "Calibri" })], spacing: { after: 120 } }));
    section.querySelectorAll("p").forEach((p) => {
      if (p.closest(".cv-job") || p.closest(".cv-edu")) return;
      const txt = p.textContent?.trim() ?? ""; if (!txt) return;
      children.push(new Paragraph({ children: [new TextRun({ text: txt, size: 22, font: "Calibri" })], spacing: { after: 80 } }));
    });
    section.querySelectorAll(".cv-job").forEach((job) => {
      const jobP = job.querySelector("p");
      if (jobP) {
        const t = jobP.querySelector("strong")?.textContent?.trim() ?? "";
        const d = jobP.querySelector(".cv-date")?.textContent?.trim() ?? "";
        let c = ""; jobP.childNodes.forEach((n) => { if (n.nodeType === Node.TEXT_NODE) c += n.textContent ?? ""; }); c = c.trim();
        children.push(new Paragraph({ children: [...(t ? [new TextRun({ text: t, bold: true, size: 22, font: "Calibri" })] : []), ...(c ? [new TextRun({ text: " " + c, size: 22, font: "Calibri" })] : []), ...(d ? [new TextRun({ text: "  " + d, size: 20, color: "6B7280", font: "Calibri" })] : [])], spacing: { after: 60 } }));
      }
      job.querySelectorAll("li").forEach((li) => {
        const txt = li.textContent?.trim() ?? ""; if (!txt) return;
        children.push(new Paragraph({ children: [new TextRun({ text: txt, size: 22, font: "Calibri" })], bullet: { level: 0 }, spacing: { after: 40 } }));
      });
    });
    section.querySelectorAll(".cv-edu").forEach((edu) => {
      const eduP = edu.querySelector("p");
      if (eduP) {
        const q = eduP.querySelector("strong")?.textContent?.trim() ?? "";
        const d = eduP.querySelector(".cv-date")?.textContent?.trim() ?? "";
        let inst = ""; eduP.childNodes.forEach((n) => { if (n.nodeType === Node.TEXT_NODE) inst += n.textContent ?? ""; }); inst = inst.trim();
        children.push(new Paragraph({ children: [...(q ? [new TextRun({ text: q, bold: true, size: 22, font: "Calibri" })] : []), ...(inst ? [new TextRun({ text: " " + inst, size: 22, color: "6B7280", font: "Calibri" })] : []), ...(d ? [new TextRun({ text: "  " + d, size: 20, color: "6B7280", font: "Calibri" })] : [])], spacing: { after: 80 } }));
      }
    });
    section.querySelectorAll("ul > li").forEach((li) => {
      if (li.closest(".cv-job") || li.closest(".cv-edu")) return;
      const se = li.querySelector("strong"); const txt = li.textContent?.trim() ?? ""; if (!txt) return;
      if (se) {
        const lb = se.textContent?.trim() ?? "";
        let desc = ""; li.childNodes.forEach((n) => { if (n !== se && n.nodeType === Node.TEXT_NODE) desc += n.textContent ?? ""; }); desc = desc.trim();
        children.push(new Paragraph({ children: [new TextRun({ text: lb, bold: true, size: 22, font: "Calibri" }), ...(desc ? [new TextRun({ text: " " + desc, size: 22, font: "Calibri" })] : [])], bullet: { level: 0 }, spacing: { after: 40 } }));
      } else {
        children.push(new Paragraph({ children: [new TextRun({ text: txt, size: 22, font: "Calibri" })], bullet: { level: 0 }, spacing: { after: 40 } }));
      }
    });
  });
  const doc = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `${displayName.replace(/[^\w\s-]/g, "").trim()} - CVLingo.docx`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadCoverLetterDocx(text: string, filename: string) {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const children = text.split("\n").map((line) =>
    new Paragraph({ children: [new TextRun({ text: line, size: 24, font: "Calibri" })], spacing: { after: line.trim() ? 120 : 0 } })
  );
  const doc = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadImpactReport(data: import("@/context/PartnerContext").ManagerDashData) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, ML = 20, MR = 20, CW = W - ML - MR;
  let y = 24;
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(22); pdf.setTextColor(13, 110, 110);
  pdf.text("Monthly Impact Report", ML, y); y += 10;
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(12); pdf.setTextColor(107, 114, 128);
  pdf.text(data.partner_name, ML, y); y += 6;
  pdf.text(currentMonthLabel(), ML, y); y += 14;
  const stats: [string, string][] = [
    ["CVs built this month", String(data.month_cvs)],
    ["Active users this month", String(data.active_this_month ?? 0)],
    ["Total CVs built", String(data.total_cvs)],
    ["Candidates in pool", String(data.total_candidates)],
  ];
  stats.forEach(([label, value]) => {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(26, 26, 26);
    pdf.text(label + ":", ML, y); pdf.setFont("helvetica", "normal"); pdf.text(value, ML + 75, y); y += 8;
  });
  y += 6;
  const langs = Object.entries(data.lang_breakdown).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (langs.length > 0) {
    pdf.setDrawColor(220, 220, 220); pdf.line(ML, y, W - MR, y); y += 6;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(13, 110, 110);
    pdf.text("Top Languages", ML, y); y += 8;
    langs.forEach(([lang, count]) => { pdf.setFont("helvetica", "normal"); pdf.setFontSize(11); pdf.setTextColor(26, 26, 26); pdf.text(`${lang}: ${count}`, ML + 4, y); y += 6; });
    y += 6;
  }
  const jobs = Object.entries(data.job_breakdown).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (jobs.length > 0) {
    pdf.setDrawColor(220, 220, 220); pdf.line(ML, y, W - MR, y); y += 6;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(13, 110, 110);
    pdf.text("Top Job Types", ML, y); y += 8;
    jobs.forEach(([job, count]) => {
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(11); pdf.setTextColor(26, 26, 26);
      pdf.splitTextToSize(`${job}: ${count}`, CW - 4).forEach((l: string) => { pdf.text(l, ML + 4, y); y += 6; });
    });
  }
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(170, 170, 170);
  pdf.text(`Generated by CVLingo · ${new Date().toLocaleDateString("en-GB")}`, W / 2, 285, { align: "center" });
  pdf.save(`${data.partner_name.replace(/[^\w\s-]/g, "").trim()} - CVLingo Impact Report - ${currentMonthLabel()}.pdf`);
}

// ── StatCard / BreakdownBar ────────────────────────────────────────────────────
export function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}

export function BreakdownBar({ label, items }: { label: string; items: Record<string, number> }) {
  const entries = Object.entries(items).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (entries.length === 0) return null;
  const max = entries[0][1];
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-5">
      <p className="mb-4 text-sm font-semibold text-foreground">{label}</p>
      <div className="space-y-2">
        {entries.map(([key, count]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-xs text-muted-foreground">{key}</span>
            <div className="flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${Math.max(4, (count / max) * 100)}%` }} />
            </div>
            <span className="w-6 shrink-0 text-right text-xs font-medium text-foreground">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── QR / Referral link ─────────────────────────────────────────────────────────
export function QRDownloadButton({ url, partnerName }: { url: string; partnerName: string }) {
  function handleDownload() {
    const canvas = document.querySelector<HTMLCanvasElement>("#partner-qr canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${partnerName.toLowerCase().replace(/\s+/g, "-")}-cvlingo-qr.png`;
    link.href = canvas.toDataURL("image/png"); link.click();
  }
  return (
    <div className="flex flex-col items-center gap-3">
      <div id="partner-qr" className="rounded-xl bg-white p-3 shadow-sm">
        <QRCodeCanvas value={url} size={160} level="M" />
      </div>
      <button type="button" onClick={handleDownload}
        className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors min-h-[44px]">
        Download QR PNG
      </button>
    </div>
  );
}

export function ReferralLinkCard({ referralUrl, partnerName }: { referralUrl: string; partnerName: string }) {
  const [copied, setCopied] = useState(false);
  function copyLink() {
    void navigator.clipboard.writeText(referralUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <div className="mb-8 rounded-2xl border border-border bg-card px-6 py-6">
      <p className="mb-3 text-sm font-semibold text-foreground">Your referral link</p>
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-4 py-3">
            <span className="flex-1 truncate font-mono text-sm text-foreground">{referralUrl}</span>
            <button type="button" onClick={copyLink}
              className="shrink-0 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity min-h-[44px]">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Share this link with your members — CVs they build will be tracked here.</p>
        </div>
        <QRDownloadButton url={referralUrl} partnerName={partnerName} />
      </div>
    </div>
  );
}

// ── NameDialog ─────────────────────────────────────────────────────────────────
export function NameDialog({ onSave }: { onSave: (name: string) => void }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim(); if (!trimmed) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from("profiles").update({ full_name: trimmed }).eq("id", user.id);
    setSaving(false); onSave(trimmed);
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="font-semibold text-foreground mb-1">What is your name?</h2>
        <p className="text-sm text-muted-foreground mb-4">Your colleagues will see it when assigning clients.</p>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
          <input type="text" placeholder="Your name" value={value} onChange={(e) => setValue(e.target.value)} autoFocus
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary" />
          <button type="submit" disabled={saving || !value.trim()}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity min-h-[44px]">
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── CoverLetterModal ───────────────────────────────────────────────────────────
export function CoverLetterModal({ client, letters, loading, error, onClose }: {
  client: { client_ref: string; display_name: string; shared: boolean; scope: string | null };
  letters: PartnerCoverLetter[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Record<number, "english" | "native">>({});
  const [editState, setEditState] = useState<Record<number, { english_text: string; native_text: string } | null>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saveError, setSaveError] = useState<Record<number, string | null>>({});
  const [copied, setCopied] = useState<number | null>(null);

  function getTab(idx: number): "english" | "native" { return activeTab[idx] ?? "english"; }
  function showNative(l: PartnerCoverLetter) { return l.language !== "English" && l.language !== "en"; }
  function isRtl(lang: string) { return RTL_LANGS.has(lang); }

  async function handleSave(idx: number, letter: PartnerCoverLetter) {
    const edit = editState[idx]; if (!edit) return;
    setSaving((s) => ({ ...s, [idx]: true })); setSaveError((s) => ({ ...s, [idx]: null }));
    try {
      const { error: err } = await supabase.rpc("partner_update_referred_cover_letter",
        { p_letter_id: letter.id, p_english_text: edit.english_text, p_native_text: edit.native_text });
      if (err) { setSaveError((s) => ({ ...s, [idx]: err.message.includes("assigned") ? "You can only edit cover letters for clients assigned to you." : err.message })); return; }
      setEditState((s) => ({ ...s, [idx]: null }));
    } finally { setSaving((s) => ({ ...s, [idx]: false })); }
  }

  function handleCopy(idx: number, letter: PartnerCoverLetter) {
    const tab = getTab(idx); const edit = editState[idx];
    const text = edit ? (tab === "english" ? edit.english_text : edit.native_text) : (tab === "english" ? letter.english_text : letter.native_text);
    void navigator.clipboard.writeText(text).then(() => { setCopied(idx); setTimeout(() => setCopied(null), 2000); });
  }

  function handleDownload(idx: number, letter: PartnerCoverLetter) {
    const edit = editState[idx]; const text = edit ? edit.english_text : letter.english_text;
    const title = letter.job_title ?? "cover-letter"; const company = letter.company ?? "";
    void downloadCoverLetterDocx(text, `${client.display_name} - ${(title + (company ? "-" + company : "")).replace(/[^\w\s-]/g, "").trim()} - CVLingo.docx`);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
          <h2 className="font-semibold text-foreground">{client.display_name} — Cover letters</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          {loading && <div className="flex justify-center py-8"><div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}
          {error && !loading && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && letters.length === 0 && <p className="text-sm text-muted-foreground">This client has not written a cover letter yet.</p>}
          {!loading && !error && letters.length > 0 && (
            <div className="space-y-6">
              {letters.map((letter, idx) => {
                const tab = getTab(idx); const edit = editState[idx] ?? null;
                const hasNative = showNative(letter); const rtl = isRtl(letter.language);
                const displayText = edit ? (tab === "english" ? edit.english_text : edit.native_text) : (tab === "english" ? letter.english_text : letter.native_text);
                return (
                  <div key={letter.id} className="rounded-xl border border-border overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/50 px-4 py-3">
                      <div><span className="font-medium text-foreground">{letter.job_title ?? "Untitled"}</span>{letter.company && <span className="ml-2 text-sm text-muted-foreground">{letter.company}</span>}</div>
                      <span className="text-xs text-muted-foreground">{fmtDate(letter.created_at)}</span>
                    </div>
                    {hasNative && (
                      <div className="flex border-b border-border">
                        {(["english", "native"] as const).map((t) => (
                          <button key={t} type="button" onClick={() => setActiveTab((s) => ({ ...s, [idx]: t }))}
                            className={`px-4 py-2 text-xs font-medium transition-colors ${tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                            {t === "english" ? "English" : letter.language}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="p-4">
                      {edit ? (
                        <textarea value={tab === "english" ? edit.english_text : edit.native_text}
                          onChange={(e) => { const v = e.target.value; setEditState((s) => ({ ...s, [idx]: tab === "english" ? { ...edit, english_text: v } : { ...edit, native_text: v } })); }}
                          dir={tab === "native" && rtl ? "rtl" : undefined}
                          style={tab === "native" && rtl ? { textAlign: "right" } : undefined}
                          className="w-full min-h-[200px] rounded-lg border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-primary resize-y" />
                      ) : (
                        <pre className="w-full text-sm text-foreground whitespace-pre-wrap font-sans" dir={tab === "native" && rtl ? "rtl" : undefined} style={tab === "native" && rtl ? { textAlign: "right" } : undefined}>{displayText}</pre>
                      )}
                      {saveError[idx] && <p className="mt-2 text-xs text-destructive">{saveError[idx]}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {edit ? (
                          <>
                            <button type="button" onClick={() => void handleSave(idx, letter)} disabled={saving[idx]}
                              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 min-h-[44px]">
                              {saving[idx] ? "Saving…" : "Save"}
                            </button>
                            <button type="button" onClick={() => setEditState((s) => ({ ...s, [idx]: null }))} disabled={saving[idx]}
                              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50 min-h-[44px]">Cancel</button>
                          </>
                        ) : (
                          <button type="button" onClick={() => setEditState((s) => ({ ...s, [idx]: { english_text: letter.english_text, native_text: letter.native_text } }))}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted min-h-[44px]">Edit</button>
                        )}
                        <button type="button" onClick={() => handleCopy(idx, letter)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted min-h-[44px]">{copied === idx ? "Copied!" : "Copy"}</button>
                        <button type="button" onClick={() => handleDownload(idx, letter)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted min-h-[44px]">Word (.docx)</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CaseStatusDialog ───────────────────────────────────────────────────────────
export function CaseStatusDialog({ client, action, onClose, onDone }: {
  client: PartnerPageClient;
  action: "close" | "reopen";
  onClose: () => void;
  onDone: () => void;
}) {
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (note.length > 500) { setError("Note must be 500 characters or fewer."); return; }
    setSaving(true); setError(null);
    const { error: err } = await supabase.rpc("set_client_case_status", {
      p_client_ref: client.client_ref,
      p_status: action === "close" ? "closed" : "active",
      p_outcome: action === "close" && outcome ? outcome : null,
      p_note: action === "close" && note.trim() ? note.trim() : null,
    });
    setSaving(false);
    if (err) { setError(err.message.includes("assigned") ? "You can only update cases assigned to you." : err.message); return; }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="font-semibold text-foreground mb-4">
          {action === "close" ? `Close case for ${client.display_name}` : `Reopen case for ${client.display_name}`}
        </h2>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          {action === "close" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Outcome (optional)</label>
                <select value={outcome} onChange={(e) => setOutcome(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
                  <option value="">— Select outcome</option>
                  {CASE_OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Note (optional, max 500 characters)</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3}
                  placeholder="Any additional context…"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary resize-y" />
                <p className="mt-0.5 text-right text-xs text-muted-foreground">{note.length}/500</p>
              </div>
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="flex-1 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 min-h-[44px]">
              {saving ? "Saving…" : action === "close" ? "Close case" : "Reopen case"}
            </button>
            <button type="button" onClick={onClose} disabled={saving}
              className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50 min-h-[44px]">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ClientRowActions ───────────────────────────────────────────────────────────
export function ClientRowActions({ client, onCaseChanged, isManager, currentUserId }: {
  client: PartnerPageClient;
  onCaseChanged: () => void;
  isManager?: boolean;
  currentUserId?: string | null;
}) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingWord, setDownloadingWord] = useState(false);
  const [clOpen, setClOpen] = useState(false);
  const [clLetters, setClLetters] = useState<PartnerCoverLetter[]>([]);
  const [clLoading, setClLoading] = useState(false);
  const [clError, setClError] = useState<string | null>(null);
  const [caseDialog, setCaseDialog] = useState<"close" | "reopen" | null>(null);

  const canAct = client.shared;
  const canCoverLetters = client.shared && client.scope !== "view_download";

  async function fetchCvHtml(): Promise<string | null> {
    const { data, error } = await supabase.rpc("get_partner_referred_cv", { p_client_ref: client.client_ref });
    if (error || !data) { if (error?.message.includes("assigned")) alert("You can only download CVs for clients assigned to you."); return null; }
    return data as string;
  }

  async function openCoverLetters() {
    setClLetters([]); setClError(null); setClLoading(true); setClOpen(true);
    try {
      const { data, error } = await supabase.rpc("get_partner_referred_cover_letters", { p_client_ref: client.client_ref });
      if (error) { setClError(error.message.includes("assigned") ? "You can only view cover letters for clients assigned to you." : error.message); return; }
      setClLetters(Array.isArray(data) ? (data as PartnerCoverLetter[]) : []);
    } finally { setClLoading(false); }
  }

  return (
    <>
      {clOpen && <CoverLetterModal client={client} letters={clLetters} loading={clLoading} error={clError} onClose={() => setClOpen(false)} />}
      {caseDialog && <CaseStatusDialog client={client} action={caseDialog} onClose={() => setCaseDialog(null)} onDone={() => { setCaseDialog(null); onCaseChanged(); }} />}
      <div className="flex flex-wrap gap-1.5">
        {client.has_cv ? (
          <>
            <button type="button" disabled={!canAct || downloadingPdf}
              onClick={() => { if (!canAct) return; setDownloadingPdf(true); void fetchCvHtml().then((h) => { if (h) downloadCvPdf(h, client.display_name); }).finally(() => setDownloadingPdf(false)); }}
              title={!canAct ? "Client has not shared their data with you" : undefined}
              className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]">
              {downloadingPdf ? "…" : "PDF"}
            </button>
            <button type="button" disabled={!canAct || downloadingWord}
              onClick={() => { if (!canAct) return; setDownloadingWord(true); void fetchCvHtml().then((h) => h ? downloadCvDocx(h, client.display_name) : null).finally(() => setDownloadingWord(false)); }}
              title={!canAct ? "Client has not shared their data with you" : undefined}
              className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]">
              {downloadingWord ? "…" : "Word"}
            </button>
          </>
        ) : <span className="text-xs text-muted-foreground self-center">No CV</span>}
        {canCoverLetters && (
          <button type="button" onClick={() => void openCoverLetters()}
            className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted min-h-[44px]">Cover letters</button>
        )}
        {client.case_status === "active" ? (
          <button type="button" onClick={() => setCaseDialog("close")}
            className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted min-h-[44px]">Close case</button>
        ) : (
          <button type="button" onClick={() => setCaseDialog("reopen")}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 min-h-[44px]">Reopen</button>
        )}
      </div>
    </>
  );
}

// ── MentorPicker ───────────────────────────────────────────────────────────────
export function MentorPicker({ members, value, onChange, placeholder, disabled, showUnassign }: {
  members: TeamMember[];
  value: string;
  onChange: (userId: string, name: string) => void;
  placeholder?: string;
  disabled?: boolean;
  showUnassign?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = members.find((m) => m.member_user_id === value);

  const activeMembers = members.filter((m) => m.status === "active" && m.member_user_id);
  const q = query.toLowerCase();
  const currentMember = value ? activeMembers.find((m) => m.member_user_id === value) : null;
  const otherMembers = activeMembers.filter((m) => m.member_user_id !== value && (
    !query || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
  ));
  // Current is always shown first (if query matches or no query)
  const currentMatchesQuery = !query || (currentMember && (
    currentMember.name.toLowerCase().includes(q) || currentMember.email.toLowerCase().includes(q)
  ));

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function pick(userId: string, name: string) {
    onChange(userId, name);
    setOpen(false);
    setQuery("");
  }

  const noResults = !currentMatchesQuery && otherMembers.length === 0;

  return (
    <div className="relative" ref={ref}>
      <button type="button" disabled={disabled} onClick={() => { setOpen((o) => !o); setQuery(""); }}
        className={`flex min-w-[140px] items-center justify-between gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50 min-h-[44px] ${!value ? "text-amber-600 font-medium" : "text-foreground"}`}>
        <span className="truncate">{selected ? selected.name : (placeholder ?? "Unassigned")}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-xl border border-border bg-background shadow-xl">
          <div className="p-2 border-b border-border">
            <input type="text" autoFocus placeholder="Search by name or email" value={query} onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs outline-none focus:border-primary" />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {noResults && <p className="px-3 py-3 text-center text-xs text-muted-foreground">No results</p>}
            {/* Current person first */}
            {currentMember && currentMatchesQuery && (
              <button key={currentMember.member_id} type="button" onClick={() => pick(currentMember.member_user_id!, currentMember.name)}
                className="w-full px-3 py-2 text-left text-xs bg-muted/50 hover:bg-muted transition-colors min-h-[44px]">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{currentMember.name}</p>
                  <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Current</span>
                </div>
                <p className="text-muted-foreground truncate">{currentMember.email}</p>
              </button>
            )}
            {/* Others */}
            {otherMembers.map((m) => (
              <button key={m.member_id} type="button" onClick={() => pick(m.member_user_id!, m.name)}
                className="w-full px-3 py-2 text-left text-xs hover:bg-muted transition-colors min-h-[44px]">
                <p className="font-medium text-foreground">{m.name}</p>
                <p className="text-muted-foreground truncate">{m.email}</p>
              </button>
            ))}
            {/* Unassign at the bottom */}
            {showUnassign && value && (
              <button type="button" onClick={() => pick("", "Unassigned")}
                className="w-full border-t border-border px-3 py-2 text-left text-xs text-amber-600 hover:bg-amber-50 transition-colors min-h-[44px]">
                Unassign
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Skeleton rows ──────────────────────────────────────────────────────────────
export function SkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-t border-border animate-pulse">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 rounded bg-muted w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonCards({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="h-4 rounded bg-muted w-2/3" />
          <div className="h-3 rounded bg-muted w-1/2" />
          <div className="h-3 rounded bg-muted w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-8 text-center">
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
}

export function Spinner() {
  return <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />;
}

export function PageSpinner() {
  return <div className="flex justify-center py-12"><Spinner /></div>;
}
