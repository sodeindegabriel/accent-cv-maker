import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import emailjs from "@emailjs/browser";
import { jsPDF } from "jspdf";
import { QRCodeCanvas } from "qrcode.react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { ObfuscatedEmail } from "@/components/ObfuscatedEmail";
import { sanitizeCvHtml } from "@/lib/sanitize";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  as string | undefined;

// ── Types ──────────────────────────────────────────────────────────────────────
interface MyPartnerRole {
  partner_id: string;
  partner_name: string;
  referral_code: string;
  role: "owner" | "manager" | "mentor";
  is_manager: boolean;
}

// get_partner_dashboard_data — full payload (managers)
interface ManagerDashData {
  partner_id: string;
  partner_name: string;
  partner_logo_url?: string | null;
  referral_code: string;
  member_role: string;
  member_count: number;
  total_cvs: number;
  month_cvs: number;
  active_this_month: number;
  total_candidates: number;
  lang_breakdown: Record<string, number>;
  job_breakdown: Record<string, number>;
}

// get_partner_dashboard_data — limited payload (mentors)
interface MentorDashData {
  partner_id: string;
  partner_name: string;
  partner_logo_url?: string | null;
  referral_code: string;
  member_role: string;
  my_assigned: number;
  my_closed: number;
}

// get_partner_clients_page row
interface PartnerPageClient {
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

// list_partner_team row
interface TeamMember {
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

// get_partner_notifications row
interface PartnerNotification {
  id: string;
  kind: string;
  actor_user_id: string | null;
  client_user_id: string | null;
  message: string;
  created_at: string;
}

interface PartnerCoverLetter {
  id: string;
  job_title: string | null;
  company: string | null;
  language: string;
  english_text: string;
  native_text: string;
  created_at: string;
}

const CASE_OUTCOMES = [
  { value: "employment",             label: "Employment found" },
  { value: "training",               label: "Training or education" },
  { value: "volunteering",           label: "Volunteering" },
  { value: "no_longer_needs_support",label: "No longer needs support" },
  { value: "moved_or_no_contact",    label: "Moved or no contact" },
  { value: "other",                  label: "Other" },
] as const;

function outcomeLabel(v: string | null) {
  return CASE_OUTCOMES.find(o => o.value === v)?.label ?? v ?? "";
}

// ── Email helper ───────────────────────────────────────────────────────────────
async function sendTeamInviteEmail(partnerName: string, inviteeEmail: string) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.warn("[team invite] EmailJS env vars missing — skipping email");
    return;
  }
  const subject = `You've been invited to join ${partnerName}'s CVLingo team`;
  const message = [
    `Hi,`,
    "",
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
    SERVICE_ID,
    TEMPLATE_ID,
    { to_email: inviteeEmail, subject, message, name: partnerName },
    { publicKey: PUBLIC_KEY },
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function currentMonthLabel() {
  return new Date().toLocaleString("en-GB", { month: "long", year: "numeric" });
}

function impactSummary(data: ManagerDashData): string {
  const topLangs = Object.entries(data.lang_breakdown)
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([lang]) => lang);
  const langStr = topLangs.length > 0
    ? ` in ${topLangs.length === 1 ? topLangs[0] : topLangs.slice(0, -1).join(", ") + " and " + topLangs[topLangs.length - 1]}`
    : "";
  return `In ${currentMonthLabel()}, ${data.month_cvs === 0 ? "no" : data.month_cvs} CV${data.month_cvs !== 1 ? "s" : ""} ${data.month_cvs === 1 ? "was" : "were"} built through ${data.partner_name}'s link${langStr}. ${data.total_candidates > 0 ? `${data.total_candidates} candidate${data.total_candidates !== 1 ? "s are" : " is"} in the talent pool.` : ""}`;
}

function roleLabel(role: string): string {
  if (role === "owner" || role === "manager") return "Manager";
  return "Mentor";
}

// ── PDF generation ─────────────────────────────────────────────────────────────
function downloadCvPdf(htmlContent: string, displayName: string) {
  const safeName = displayName.replace(/[^\w\s-]/g, "").trim();
  const filename = `${safeName} - CVLingo.pdf`;
  const el = document.createElement("div");
  el.innerHTML = sanitizeCvHtml(htmlContent);
  el.style.cssText = "position:absolute;visibility:hidden;left:-9999px;top:-9999px;";
  document.body.appendChild(el);
  try {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210; const ML = 18; const MR = 18; const CW = W - ML - MR;
    let y = 22;
    const newPageIfNeeded = (h: number) => { if (y + h > 282) { pdf.addPage(); y = 18; } };
    const cvName = el.querySelector(".cv-name")?.textContent?.trim() ?? displayName;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(26); pdf.setTextColor(26, 26, 26);
    pdf.splitTextToSize(cvName, CW).forEach((line: string) => { pdf.text(line, W / 2, y, { align: "center" }); y += 10; });
    y += 3;
    const cvContact = el.querySelector(".cv-contact")?.textContent?.trim() ?? "";
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(107, 114, 128);
    pdf.splitTextToSize(cvContact, CW).forEach((line: string) => { pdf.text(line, W / 2, y, { align: "center" }); y += 6; });
    y += 8;
    el.querySelectorAll(".cv-section").forEach((section) => {
      newPageIfNeeded(14);
      pdf.setDrawColor(220, 220, 220); pdf.line(ML, y, W - MR, y); y += 5;
      const heading = section.querySelector("h2")?.textContent?.trim() ?? "";
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(13, 110, 110);
      pdf.text(heading, ML, y); y += 6;
      section.querySelectorAll("p").forEach((p) => {
        if (p.closest(".cv-job") || p.closest(".cv-edu")) return;
        const txt = p.textContent?.trim() ?? ""; if (!txt) return;
        newPageIfNeeded(6); pdf.setFont("helvetica", "normal"); pdf.setFontSize(11); pdf.setTextColor(26, 26, 26);
        pdf.splitTextToSize(txt, CW).forEach((line: string) => { newPageIfNeeded(6); pdf.text(line, ML, y); y += 6; }); y += 3;
      });
      section.querySelectorAll(".cv-job").forEach((job) => {
        newPageIfNeeded(8);
        const jobP = job.querySelector("p");
        if (jobP) {
          const titleText = jobP.querySelector("strong")?.textContent?.trim() ?? "";
          const dateText = jobP.querySelector(".cv-date")?.textContent?.trim() ?? "";
          let companyText = "";
          jobP.childNodes.forEach((node) => { if (node.nodeType === Node.TEXT_NODE) companyText += node.textContent ?? ""; });
          companyText = companyText.trim();
          pdf.setFontSize(11); pdf.setFont("helvetica", "bold"); pdf.setTextColor(26, 26, 26);
          const titleW = pdf.getTextWidth(titleText + " ");
          pdf.text(titleText, ML, y); pdf.setFont("helvetica", "normal");
          if (companyText) pdf.text(companyText, ML + titleW, y);
          if (dateText) { pdf.setTextColor(107, 114, 128); pdf.text(dateText, W - MR, y, { align: "right" }); pdf.setTextColor(26, 26, 26); }
          y += 6;
        }
        job.querySelectorAll("li").forEach((li) => {
          const txt = li.textContent?.trim() ?? ""; if (!txt) return;
          newPageIfNeeded(6); pdf.setFont("helvetica", "normal"); pdf.setFontSize(11); pdf.setTextColor(26, 26, 26);
          pdf.text("•", ML + 1, y);
          pdf.splitTextToSize(txt, CW - 5).forEach((line: string) => { newPageIfNeeded(6); pdf.text(line, ML + 5, y); y += 6; });
        });
        y += 2;
      });
      section.querySelectorAll(".cv-edu").forEach((edu) => {
        newPageIfNeeded(8);
        const eduP = edu.querySelector("p");
        if (eduP) {
          const qualText = eduP.querySelector("strong")?.textContent?.trim() ?? "";
          const dateText = eduP.querySelector(".cv-date")?.textContent?.trim() ?? "";
          pdf.setFontSize(11); pdf.setFont("helvetica", "bold"); pdf.setTextColor(26, 26, 26);
          pdf.text(qualText, ML, y);
          if (dateText) { pdf.setTextColor(107, 114, 128); pdf.text(dateText, W - MR, y, { align: "right" }); }
          y += 6;
          let instText = "";
          eduP.childNodes.forEach((node) => { if (node.nodeType === Node.TEXT_NODE) instText += node.textContent ?? ""; });
          instText = instText.trim();
          if (instText) { pdf.setFont("helvetica", "normal"); pdf.setTextColor(107, 114, 128); pdf.text(instText, ML, y); y += 6; }
        }
        y += 1;
      });
      section.querySelectorAll("ul > li").forEach((li) => {
        if (li.closest(".cv-job") || li.closest(".cv-edu")) return;
        const strongEl = li.querySelector("strong");
        newPageIfNeeded(6); pdf.setFontSize(11); pdf.setTextColor(26, 26, 26);
        if (strongEl) {
          const label = strongEl.textContent?.trim() ?? "";
          let desc = "";
          li.childNodes.forEach((node) => { if (node !== strongEl && node.nodeType === Node.TEXT_NODE) desc += node.textContent ?? ""; });
          desc = desc.trim();
          pdf.setFont("helvetica", "bold"); pdf.text("• " + label, ML + 1, y); y += 6;
          if (desc) { pdf.setFont("helvetica", "normal"); pdf.splitTextToSize(desc, CW - 5).forEach((line: string) => { newPageIfNeeded(6); pdf.text(line, ML + 5, y); y += 6; }); }
          y += 2;
        } else {
          const txt = li.textContent?.trim() ?? ""; if (!txt) return;
          pdf.setFont("helvetica", "normal"); pdf.text("•", ML + 1, y);
          pdf.splitTextToSize(txt, CW - 5).forEach((line: string) => { newPageIfNeeded(6); pdf.text(line, ML + 5, y); y += 6; });
          y += 1;
        }
      });
      y += 4;
    });
    pdf.save(filename);
  } finally {
    document.body.removeChild(el);
  }
}

// ── Word (docx) generation ─────────────────────────────────────────────────────
async function downloadCvDocx(htmlContent: string, displayName: string) {
  const { Document, Packer, Paragraph, TextRun, BorderStyle, AlignmentType } =
    await import("docx");
  const el = document.createElement("div");
  el.innerHTML = sanitizeCvHtml(htmlContent);
  type DocParagraph = InstanceType<typeof Paragraph>;
  const children: DocParagraph[] = [];
  const cvName = el.querySelector(".cv-name")?.textContent?.trim() ?? displayName;
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: cvName, bold: true, size: 52, font: "Calibri" })],
    spacing: { after: 120 },
  }));
  const cvContact = el.querySelector(".cv-contact")?.textContent?.trim() ?? "";
  if (cvContact) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: cvContact, size: 20, color: "6B7280", font: "Calibri" })],
      spacing: { after: 280 },
    }));
  }
  el.querySelectorAll(".cv-section").forEach((section) => {
    const heading = section.querySelector("h2")?.textContent?.trim() ?? "";
    children.push(new Paragraph({
      border: { bottom: { color: "DCDCDC", style: BorderStyle.SINGLE, size: 6 } },
      children: [], spacing: { before: 240, after: 120 },
    }));
    children.push(new Paragraph({
      children: [new TextRun({ text: heading, bold: true, size: 26, color: "0D6E6E", font: "Calibri" })],
      spacing: { after: 120 },
    }));
    section.querySelectorAll("p").forEach((p) => {
      if (p.closest(".cv-job") || p.closest(".cv-edu")) return;
      const txt = p.textContent?.trim() ?? "";
      if (!txt) return;
      children.push(new Paragraph({
        children: [new TextRun({ text: txt, size: 22, font: "Calibri" })],
        spacing: { after: 80 },
      }));
    });
    section.querySelectorAll(".cv-job").forEach((job) => {
      const jobP = job.querySelector("p");
      if (jobP) {
        const titleText = jobP.querySelector("strong")?.textContent?.trim() ?? "";
        const dateText = jobP.querySelector(".cv-date")?.textContent?.trim() ?? "";
        let companyText = "";
        jobP.childNodes.forEach((node) => { if (node.nodeType === Node.TEXT_NODE) companyText += node.textContent ?? ""; });
        companyText = companyText.trim();
        const runs = [
          ...(titleText ? [new TextRun({ text: titleText, bold: true, size: 22, font: "Calibri" })] : []),
          ...(companyText ? [new TextRun({ text: " " + companyText, size: 22, font: "Calibri" })] : []),
          ...(dateText ? [new TextRun({ text: "  " + dateText, size: 20, color: "6B7280", font: "Calibri" })] : []),
        ];
        children.push(new Paragraph({ children: runs, spacing: { after: 60 } }));
      }
      job.querySelectorAll("li").forEach((li) => {
        const txt = li.textContent?.trim() ?? "";
        if (!txt) return;
        children.push(new Paragraph({
          children: [new TextRun({ text: txt, size: 22, font: "Calibri" })],
          bullet: { level: 0 }, spacing: { after: 40 },
        }));
      });
    });
    section.querySelectorAll(".cv-edu").forEach((edu) => {
      const eduP = edu.querySelector("p");
      if (eduP) {
        const qualText = eduP.querySelector("strong")?.textContent?.trim() ?? "";
        const dateText = eduP.querySelector(".cv-date")?.textContent?.trim() ?? "";
        let instText = "";
        eduP.childNodes.forEach((node) => { if (node.nodeType === Node.TEXT_NODE) instText += node.textContent ?? ""; });
        instText = instText.trim();
        const runs = [
          ...(qualText ? [new TextRun({ text: qualText, bold: true, size: 22, font: "Calibri" })] : []),
          ...(instText ? [new TextRun({ text: " " + instText, size: 22, color: "6B7280", font: "Calibri" })] : []),
          ...(dateText ? [new TextRun({ text: "  " + dateText, size: 20, color: "6B7280", font: "Calibri" })] : []),
        ];
        children.push(new Paragraph({ children: runs, spacing: { after: 80 } }));
      }
    });
    section.querySelectorAll("ul > li").forEach((li) => {
      if (li.closest(".cv-job") || li.closest(".cv-edu")) return;
      const strongEl = li.querySelector("strong");
      const txt = li.textContent?.trim() ?? "";
      if (!txt) return;
      if (strongEl) {
        const label = strongEl.textContent?.trim() ?? "";
        let desc = "";
        li.childNodes.forEach((node) => { if (node !== strongEl && node.nodeType === Node.TEXT_NODE) desc += node.textContent ?? ""; });
        desc = desc.trim();
        children.push(new Paragraph({
          children: [
            new TextRun({ text: label, bold: true, size: 22, font: "Calibri" }),
            ...(desc ? [new TextRun({ text: " " + desc, size: 22, font: "Calibri" })] : []),
          ],
          bullet: { level: 0 }, spacing: { after: 40 },
        }));
      } else {
        children.push(new Paragraph({
          children: [new TextRun({ text: txt, size: 22, font: "Calibri" })],
          bullet: { level: 0 }, spacing: { after: 40 },
        }));
      }
    });
  });
  const doc = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${displayName.replace(/[^\w\s-]/g, "").trim()} - CVLingo.docx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Impact report PDF ──────────────────────────────────────────────────────────
function downloadImpactReport(data: ManagerDashData) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210; const ML = 20; const MR = 20; const CW = W - ML - MR;
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
    pdf.text(label + ":", ML, y);
    pdf.setFont("helvetica", "normal"); pdf.text(value, ML + 75, y); y += 8;
  });
  y += 6;
  const langs = Object.entries(data.lang_breakdown).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (langs.length > 0) {
    pdf.setDrawColor(220, 220, 220); pdf.line(ML, y, W - MR, y); y += 6;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(13, 110, 110);
    pdf.text("Top Languages", ML, y); y += 8;
    langs.forEach(([lang, count]) => {
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(11); pdf.setTextColor(26, 26, 26);
      pdf.text(`${lang}: ${count}`, ML + 4, y); y += 6;
    });
    y += 6;
  }
  const jobs = Object.entries(data.job_breakdown).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (jobs.length > 0) {
    pdf.setDrawColor(220, 220, 220); pdf.line(ML, y, W - MR, y); y += 6;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(13, 110, 110);
    pdf.text("Top Job Types", ML, y); y += 8;
    jobs.forEach(([job, count]) => {
      const txt = `${job}: ${count}`;
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(11); pdf.setTextColor(26, 26, 26);
      pdf.splitTextToSize(txt, CW - 4).forEach((line: string) => { pdf.text(line, ML + 4, y); y += 6; });
    });
  }
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(170, 170, 170);
  pdf.text(`Generated by CVLingo · ${new Date().toLocaleDateString("en-GB")}`, W / 2, 285, { align: "center" });
  const safePartner = data.partner_name.replace(/[^\w\s-]/g, "").trim();
  pdf.save(`${safePartner} - CVLingo Impact Report - ${currentMonthLabel()}.pdf`);
}

// ── Partner nav ────────────────────────────────────────────────────────────────
function PartnerNav({
  orgName,
  onSignOut,
  bellSlot,
}: {
  orgName: string;
  onSignOut: () => void;
  bellSlot?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <a href="/" aria-label="CVLingo home">
            <img src="/cvlingo-logo.svg" alt="CVLingo" className="h-8 w-8 rounded-full" />
          </a>
          {orgName && (
            <>
              <span className="text-border select-none">|</span>
              <span className="text-sm font-medium text-foreground">{orgName}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {bellSlot}
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}

// ── Breakdown bar ──────────────────────────────────────────────────────────────
function BreakdownBar({ label, items }: { label: string; items: Record<string, number> }) {
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

// ── QR download ────────────────────────────────────────────────────────────────
function QRDownloadButton({ url, partnerName }: { url: string; partnerName: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  function handleDownload() {
    const canvas = document.querySelector<HTMLCanvasElement>("#partner-qr canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${partnerName.toLowerCase().replace(/\s+/g, "-")}-cvlingo-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }
  return (
    <div className="flex flex-col items-center gap-3">
      <div id="partner-qr" className="rounded-xl bg-white p-3 shadow-sm">
        <QRCodeCanvas value={url} size={160} level="M" ref={canvasRef} />
      </div>
      <button
        type="button"
        onClick={handleDownload}
        className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        Download QR PNG
      </button>
    </div>
  );
}

// ── Referral link card ─────────────────────────────────────────────────────────
function ReferralLinkCard({ referralUrl, partnerName }: { referralUrl: string; partnerName: string }) {
  const [copied, setCopied] = useState(false);
  function copyLink() {
    void navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div className="mb-8 rounded-2xl border border-border bg-card px-6 py-6">
      <p className="mb-3 text-sm font-semibold text-foreground">Your referral link</p>
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-4 py-3">
            <span className="flex-1 truncate font-mono text-sm text-foreground">{referralUrl}</span>
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Share this link with your members — CVs they build will be tracked here.
          </p>
        </div>
        <QRDownloadButton url={referralUrl} partnerName={partnerName} />
      </div>
    </div>
  );
}

// ── Cover letter Word download ─────────────────────────────────────────────────
async function downloadCoverLetterDocx(text: string, filename: string) {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const children = text.split("\n").map(
    (line) => new Paragraph({ children: [new TextRun({ text: line, size: 24, font: "Calibri" })], spacing: { after: line.trim() ? 120 : 0 } })
  );
  const doc = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Cover letter modal ─────────────────────────────────────────────────────────
const RTL_LANGS = new Set(["Arabic", "Urdu", "Persian", "Kurdish", "Farsi"]);

function CoverLetterModal({ client, letters, loading, error, onClose }: {
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
  function isRtl(language: string) { return RTL_LANGS.has(language); }
  function showNativeTab(letter: PartnerCoverLetter) { return letter.language !== "English" && letter.language !== "en"; }

  async function handleSave(idx: number, letter: PartnerCoverLetter) {
    const edit = editState[idx];
    if (!edit) return;
    setSaving((s) => ({ ...s, [idx]: true }));
    setSaveError((s) => ({ ...s, [idx]: null }));
    try {
      const { error: rpcErr } = await supabase.rpc("partner_update_referred_cover_letter", {
        p_letter_id: letter.id, p_english_text: edit.english_text, p_native_text: edit.native_text,
      });
      if (rpcErr) {
        setSaveError((s) => ({ ...s, [idx]: rpcErr.message.includes("assigned to them") ? "You can only edit cover letters for clients assigned to you." : rpcErr.message }));
        return;
      }
      setEditState((s) => ({ ...s, [idx]: null }));
    } finally {
      setSaving((s) => ({ ...s, [idx]: false }));
    }
  }

  function handleCopy(idx: number, letter: PartnerCoverLetter) {
    const tab = getTab(idx);
    const edit = editState[idx];
    const text = edit
      ? (tab === "english" ? edit.english_text : edit.native_text)
      : (tab === "english" ? letter.english_text : letter.native_text);
    void navigator.clipboard.writeText(text).then(() => { setCopied(idx); setTimeout(() => setCopied(null), 2000); });
  }

  function handleDownload(idx: number, letter: PartnerCoverLetter) {
    const edit = editState[idx];
    const text = edit ? edit.english_text : letter.english_text;
    const title = letter.job_title ?? "cover-letter";
    const company = letter.company ?? "";
    const safeTitle = `${title}${company ? "-" + company : ""}`.replace(/[^\w\s-]/g, "").trim();
    void downloadCoverLetterDocx(text, `${client.display_name} - ${safeTitle} - CVLingo.docx`);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
          <h2 className="font-semibold text-foreground">{client.display_name} — Cover letters</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted transition-colors" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          {loading && <div className="flex justify-center py-8"><div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}
          {error && !loading && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && letters.length === 0 && (
            <p className="text-sm text-muted-foreground">This client has not written a cover letter yet.</p>
          )}
          {!loading && !error && letters.length > 0 && (
            <div className="space-y-6">
              {letters.map((letter, idx) => {
                const tab = getTab(idx);
                const edit = editState[idx] ?? null;
                const showNative = showNativeTab(letter);
                const rtl = isRtl(letter.language);
                const displayText = edit
                  ? (tab === "english" ? edit.english_text : edit.native_text)
                  : (tab === "english" ? letter.english_text : letter.native_text);
                return (
                  <div key={letter.id} className="rounded-xl border border-border overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/50 px-4 py-3">
                      <div>
                        <span className="font-medium text-foreground">{letter.job_title ?? "Untitled"}</span>
                        {letter.company && <span className="ml-2 text-sm text-muted-foreground">{letter.company}</span>}
                      </div>
                      <span className="text-xs text-muted-foreground">{fmtDate(letter.created_at)}</span>
                    </div>
                    {showNative && (
                      <div className="flex border-b border-border">
                        <button type="button" onClick={() => setActiveTab((s) => ({ ...s, [idx]: "english" }))}
                          className={`px-4 py-2 text-xs font-medium transition-colors ${tab === "english" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                          English
                        </button>
                        <button type="button" onClick={() => setActiveTab((s) => ({ ...s, [idx]: "native" }))}
                          className={`px-4 py-2 text-xs font-medium transition-colors ${tab === "native" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                          {letter.language}
                        </button>
                      </div>
                    )}
                    <div className="p-4">
                      {edit ? (
                        <textarea
                          className="w-full min-h-[200px] rounded-lg border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-primary resize-y"
                          value={tab === "english" ? edit.english_text : edit.native_text}
                          dir={tab === "native" && rtl ? "rtl" : undefined}
                          style={tab === "native" && rtl ? { textAlign: "right" } : undefined}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditState((s) => ({
                              ...s,
                              [idx]: tab === "english" ? { ...edit, english_text: val } : { ...edit, native_text: val },
                            }));
                          }}
                        />
                      ) : (
                        <pre className="w-full text-sm text-foreground whitespace-pre-wrap font-sans"
                          dir={tab === "native" && rtl ? "rtl" : undefined}
                          style={tab === "native" && rtl ? { textAlign: "right" } : undefined}>
                          {displayText}
                        </pre>
                      )}
                      {saveError[idx] && <p className="mt-2 text-xs text-destructive">{saveError[idx]}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {edit ? (
                          <>
                            <button type="button" onClick={() => void handleSave(idx, letter)} disabled={saving[idx]}
                              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
                              {saving[idx] ? "Saving…" : "Save"}
                            </button>
                            <button type="button" onClick={() => setEditState((s) => ({ ...s, [idx]: null }))} disabled={saving[idx]}
                              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50">
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button type="button" onClick={() => setEditState((s) => ({ ...s, [idx]: { english_text: letter.english_text, native_text: letter.native_text } }))}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors">
                            Edit
                          </button>
                        )}
                        <button type="button" onClick={() => handleCopy(idx, letter)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors">
                          {copied === idx ? "Copied!" : "Copy"}
                        </button>
                        <button type="button" onClick={() => handleDownload(idx, letter)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors">
                          Word (.docx)
                        </button>
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

// ── Name dialog (first-login) ──────────────────────────────────────────────────
function NameDialog({ onSave }: { onSave: (name: string) => void }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ full_name: trimmed }).eq("id", user.id);
    }
    setSaving(false);
    onSave(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="font-semibold text-foreground mb-1">What is your name?</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Your colleagues will see it when assigning clients.
        </p>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Your name"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
          />
          <button type="submit" disabled={saving || !value.trim()}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Case status dialog ─────────────────────────────────────────────────────────
function CaseStatusDialog({
  client,
  action,
  onClose,
  onDone,
}: {
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
    setSaving(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("set_client_case_status", {
      p_client_ref: client.client_ref,
      p_status: action === "close" ? "closed" : "active",
      p_outcome: action === "close" && outcome ? outcome : null,
      p_note: action === "close" && note.trim() ? note.trim() : null,
    });
    setSaving(false);
    if (rpcErr) {
      setError(
        rpcErr.message.includes("assigned to them")
          ? "You can only update cases assigned to you."
          : rpcErr.message
      );
      return;
    }
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
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                >
                  <option value="">— Select outcome</option>
                  {CASE_OUTCOMES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Note (optional, max 500 characters)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Any additional context..."
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary resize-y"
                />
                <p className="mt-0.5 text-right text-xs text-muted-foreground">{note.length}/500</p>
              </div>
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="flex-1 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
              {saving ? "Saving…" : action === "close" ? "Close case" : "Reopen case"}
            </button>
            <button type="button" onClick={onClose} disabled={saving}
              className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Client row actions (CV PDF/Word + cover letters + case status) ─────────────
function ClientRowActions({
  client,
  onCaseChanged,
}: {
  client: PartnerPageClient;
  onCaseChanged: () => void;
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
    if (error || !data) {
      if (error?.message.includes("assigned to them")) {
        alert("You can only download CVs for clients assigned to you.");
      }
      return null;
    }
    return data as string;
  }

  async function handlePdf() {
    setDownloadingPdf(true);
    try {
      const html = await fetchCvHtml();
      if (html) downloadCvPdf(html, client.display_name);
    } finally { setDownloadingPdf(false); }
  }

  async function handleWord() {
    setDownloadingWord(true);
    try {
      const html = await fetchCvHtml();
      if (html) await downloadCvDocx(html, client.display_name);
    } catch (err) { console.error("[word export]", err); }
    finally { setDownloadingWord(false); }
  }

  async function openCoverLetters() {
    setClLetters([]);
    setClError(null);
    setClLoading(true);
    setClOpen(true);
    try {
      const { data, error } = await supabase.rpc("get_partner_referred_cover_letters", { p_client_ref: client.client_ref });
      if (error) {
        setClError(error.message.includes("assigned to them") ? "You can only view cover letters for clients assigned to you." : error.message);
        return;
      }
      setClLetters(Array.isArray(data) ? (data as PartnerCoverLetter[]) : []);
    } finally { setClLoading(false); }
  }

  return (
    <>
      {clOpen && (
        <CoverLetterModal
          client={client}
          letters={clLetters}
          loading={clLoading}
          error={clError}
          onClose={() => setClOpen(false)}
        />
      )}
      {caseDialog && (
        <CaseStatusDialog
          client={client}
          action={caseDialog}
          onClose={() => setCaseDialog(null)}
          onDone={() => { setCaseDialog(null); onCaseChanged(); }}
        />
      )}
      <div className="flex flex-wrap gap-1.5">
        {client.has_cv ? (
          <>
            <button type="button" onClick={() => canAct && void handlePdf()} disabled={!canAct || downloadingPdf}
              title={!canAct ? "Client has not shared their data with you" : undefined}
              className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {downloadingPdf ? "…" : "PDF"}
            </button>
            <button type="button" onClick={() => canAct && void handleWord()} disabled={!canAct || downloadingWord}
              title={!canAct ? "Client has not shared their data with you" : undefined}
              className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {downloadingWord ? "…" : "Word"}
            </button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">No CV yet</span>
        )}
        {canCoverLetters && (
          <button type="button" onClick={() => void openCoverLetters()}
            className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors">
            Cover letters
          </button>
        )}
        {client.case_status === "active" ? (
          <button type="button" onClick={() => setCaseDialog("close")}
            className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
            Close case
          </button>
        ) : (
          <button type="button" onClick={() => setCaseDialog("reopen")}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors">
            Reopen
          </button>
        )}
      </div>
    </>
  );
}

// ── Shared client table (mentor + manager) ─────────────────────────────────────
const PAGE_SIZE = 10;

function ClientsTable({
  clients,
  total,
  page,
  onPageChange,
  onCaseChanged,
  showMentorCol,
  title,
  emptyMessage,
}: {
  clients: PartnerPageClient[];
  total: number;
  page: number;
  onPageChange: (p: number) => void;
  onCaseChanged: () => void;
  showMentorCol?: boolean;
  title?: string;
  emptyMessage?: string;
}) {
  if (total === 0 && clients.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage ?? "No clients found."}</p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <div className="rounded-2xl border border-border bg-card">
      {title && (
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-semibold text-foreground">{title} ({total})</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Names show first name and last initial only.
          </p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Language</th>
              {showMentorCol && <th className="px-4 py-2">Assigned to</th>}
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Date joined</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.client_ref} className={`border-t border-border ${c.case_status === "closed" ? "opacity-70" : ""}`}>
                <td className="px-4 py-2 font-medium">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>{c.display_name}</span>
                    {c.shared ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Shared</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Not shared</span>
                    )}
                    {c.case_status === "closed" && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Case closed</span>
                    )}
                  </div>
                  {c.case_status === "closed" && c.outcome && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{outcomeLabel(c.outcome)}</p>
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{c.language}</td>
                {showMentorCol && (
                  <td className="px-4 py-2 text-muted-foreground">
                    {c.mentor_name ?? <span className="text-muted-foreground/60">Unassigned</span>}
                  </td>
                )}
                <td className="px-4 py-2">
                  {c.has_cv ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">CV built</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">No CV</span>
                  )}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{fmtDate(c.joined_at)}</td>
                <td className="px-4 py-2">
                  <ClientRowActions client={c} onCaseChanged={onCaseChanged} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          <p className="text-sm text-muted-foreground">Showing {from}–{to} of {total}</p>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onPageChange(Math.max(0, page - 1))} disabled={page === 0}
              className="min-h-[44px] rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 transition-colors">
              Previous
            </button>
            <button type="button" onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
              className="min-h-[44px] rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 transition-colors">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Notification bell ──────────────────────────────────────────────────────────
function NotificationBell({
  partnerId,
  onOpenActivity,
}: {
  partnerId: string;
  onOpenActivity: () => void;
}) {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PartnerNotification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadCount();
    const t = setInterval(() => void loadCount(), 60_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId]);

  async function loadCount() {
    const { data } = await supabase.rpc("get_partner_notifications");
    if (data) {
      const r = data as { rows: PartnerNotification[]; unread_count: number };
      setUnread(r.unread_count ?? 0);
    }
  }

  async function handleOpen() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    const { data } = await supabase.rpc("get_partner_notifications");
    if (data) {
      const r = data as { rows: PartnerNotification[]; unread_count: number };
      setRows(r.rows ?? []);
      setUnread(0);
    }
    setLoading(false);
    await supabase.rpc("mark_partner_notifications_seen");
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => void handleOpen()}
        className="relative rounded-xl border border-border p-2 text-muted-foreground hover:bg-muted transition-colors"
        aria-label="Notifications">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-2xl border border-border bg-background shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setOpen(false); onOpenActivity(); }}
                className="text-xs text-primary hover:underline">
                View all
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && <div className="flex justify-center py-6"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}
            {!loading && rows.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>}
            {!loading && rows.map((n) => (
              <div key={n.id} className="border-b border-border px-4 py-3 last:border-0">
                <p className="text-sm text-foreground">{n.message}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{fmtDate(n.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mentor view ────────────────────────────────────────────────────────────────
function MentorView({
  roleInfo,
  dashData,
}: {
  roleInfo: MyPartnerRole;
  dashData: MentorDashData;
}) {
  const referralUrl = `https://www.cvlingo.com/?ref=${roleInfo.referral_code}`;
  const [clients, setClients] = useState<PartnerPageClient[]>([]);
  const [clientsTotal, setClientsTotal] = useState(0);
  const [clientsPage, setClientsPage] = useState(0);
  const [loadingClients, setLoadingClients] = useState(true);

  useEffect(() => { void fetchClients(0); }, []);

  async function fetchClients(p: number) {
    setLoadingClients(true);
    const { data } = await supabase.rpc("get_partner_clients_page", {
      p_limit: PAGE_SIZE,
      p_offset: p * PAGE_SIZE,
      p_filter: "all",
      p_mentor_user_id: null,
      p_search: null,
    });
    if (data) {
      const r = data as { rows: PartnerPageClient[]; total: number; unassigned_count: number | null };
      setClients(r.rows ?? []);
      setClientsTotal(r.total ?? 0);
    }
    setLoadingClients(false);
  }

  function handlePageChange(p: number) {
    setClientsPage(p);
    void fetchClients(p);
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Partner Dashboard</p>
        <h1 className="mt-1 font-serif text-3xl text-foreground md:text-4xl">{roleInfo.partner_name}</h1>
        <p className="mt-1 text-xs text-muted-foreground">Mentor</p>
      </div>

      {/* Referral link + QR */}
      <ReferralLinkCard referralUrl={referralUrl} partnerName={roleInfo.partner_name} />

      {/* Caseload counts */}
      <div className="mb-8 grid grid-cols-2 gap-4">
        <StatCard label="My active clients" value={dashData.my_assigned} />
        <StatCard label="Cases closed" value={dashData.my_closed} />
      </div>

      {/* Client table */}
      {loadingClients ? (
        <div className="flex justify-center py-8">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <ClientsTable
          clients={clients}
          total={clientsTotal}
          page={clientsPage}
          onPageChange={handlePageChange}
          onCaseChanged={() => void fetchClients(clientsPage)}
          title="My clients"
          emptyMessage="No clients have been assigned to you yet. Your manager assigns clients to you."
        />
      )}
    </main>
  );
}

// ── Manager view (items 1+2 stub — clients/team/activity tabs added in later commits) ─
function ManagerView({
  roleInfo,
  dashData,
}: {
  roleInfo: MyPartnerRole;
  dashData: ManagerDashData;
}) {
  const referralUrl = `https://www.cvlingo.com/?ref=${roleInfo.referral_code}`;
  const [activeTab, setActiveTab] = useState<"clients" | "team" | "activity">("clients");
  const [clients, setClients] = useState<PartnerPageClient[]>([]);
  const [clientsTotal, setClientsTotal] = useState(0);
  const [clientsPage, setClientsPage] = useState(0);
  const [loadingClients, setLoadingClients] = useState(true);

  useEffect(() => { void fetchClients(0); }, []);

  async function fetchClients(p: number) {
    setLoadingClients(true);
    const { data } = await supabase.rpc("get_partner_clients_page", {
      p_limit: PAGE_SIZE,
      p_offset: p * PAGE_SIZE,
      p_filter: "all",
      p_mentor_user_id: null,
      p_search: null,
    });
    if (data) {
      const r = data as { rows: PartnerPageClient[]; total: number; unassigned_count: number | null };
      setClients(r.rows ?? []);
      setClientsTotal(r.total ?? 0);
    }
    setLoadingClients(false);
  }

  function handlePageChange(p: number) {
    setClientsPage(p);
    void fetchClients(p);
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center gap-4">
        {dashData.partner_logo_url && (
          <img src={dashData.partner_logo_url} alt={dashData.partner_name}
            className="max-h-[56px] max-w-[180px] w-auto h-auto object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        )}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Partner Dashboard</p>
          <h1 className="mt-1 font-serif text-3xl text-foreground md:text-4xl">{dashData.partner_name}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{roleLabel(dashData.member_role)}</p>
        </div>
      </div>

      {/* Referral link + QR */}
      <ReferralLinkCard referralUrl={referralUrl} partnerName={dashData.partner_name} />

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total CVs built" value={dashData.total_cvs} />
        <StatCard label={`CVs in ${currentMonthLabel()}`} value={dashData.month_cvs} />
        <StatCard label="Active this month" value={dashData.active_this_month ?? 0} />
        <StatCard label="Candidates in pool" value={dashData.total_candidates} />
      </div>

      {/* Monthly impact summary + Download Report */}
      <div className="mb-8 rounded-2xl border border-primary/20 bg-primary/5 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-primary">Monthly impact</p>
            <p className="mt-1 text-sm text-foreground">{impactSummary(dashData)}</p>
          </div>
          <button type="button" onClick={() => downloadImpactReport(dashData)}
            className="shrink-0 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors">
            Download Report PDF
          </button>
        </div>
      </div>

      {/* Breakdowns */}
      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <BreakdownBar label="Languages" items={dashData.lang_breakdown} />
        <BreakdownBar label="Job types" items={dashData.job_breakdown} />
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-border bg-muted p-1 w-fit">
        {(["clients", "team", "activity"] as const).map((tab) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              activeTab === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            {tab === "clients" ? "Clients" : tab === "team" ? "Team" : "Activity"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "clients" && (
        loadingClients ? (
          <div className="flex justify-center py-8">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <ClientsTable
            clients={clients}
            total={clientsTotal}
            page={clientsPage}
            onPageChange={handlePageChange}
            onCaseChanged={() => void fetchClients(clientsPage)}
            showMentorCol
            title="Clients"
            emptyMessage="No clients yet. Share your referral link to start tracking."
          />
        )
      )}

      {activeTab === "team" && (
        <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">Team management coming soon in the next update.</p>
        </div>
      )}

      {activeTab === "activity" && (
        <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">Activity feed coming soon in the next update.</p>
        </div>
      )}
    </main>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
function PartnerDashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const [roleInfo, setRoleInfo] = useState<MyPartnerRole | null>(null);
  const [dashData, setDashData] = useState<ManagerDashData | MentorDashData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showNameDialog, setShowNameDialog] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/build" }); return; }

    Promise.all([
      supabase.rpc("get_my_partner_role"),
      supabase.rpc("get_partner_dashboard_data"),
    ]).then(([{ data: roleRaw, error: roleErr }, { data: dashRaw, error: dashErr }]) => {
      if (roleErr || !roleRaw) {
        if (dashErr || !dashRaw) { navigate({ to: "/dashboard" }); return; }
      }
      if (roleErr || !roleRaw) { navigate({ to: "/dashboard" }); return; }

      const role = roleRaw as MyPartnerRole;
      setRoleInfo(role);

      if (dashErr || !dashRaw) { setLoadError(dashErr?.message ?? "Failed to load dashboard"); return; }
      setDashData(dashRaw as ManagerDashData | MentorDashData);

      // Check if name is set (for first-login dialog)
      void supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle().then(({ data: p }) => {
        if (!p?.full_name || !p.full_name.trim()) setShowNameDialog(true);
      });
    });
  }, [authLoading, user, navigate]);

  if (authLoading || (!dashData && !loadError)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col">
        <PartnerNav orgName="" onSignOut={() => void signOut()} />
        <main className="flex flex-1 items-center justify-center px-5">
          <p className="text-sm text-destructive">Failed to load dashboard: {loadError}</p>
        </main>
      </div>
    );
  }

  const isManager = roleInfo?.is_manager ?? false;
  const orgName = roleInfo?.partner_name ?? (dashData as ManagerDashData | MentorDashData | null)?.partner_name ?? "";
  const partnerId = roleInfo?.partner_id ?? "";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {showNameDialog && (
        <NameDialog onSave={() => setShowNameDialog(false)} />
      )}

      <PartnerNav
        orgName={orgName}
        onSignOut={() => void signOut()}
        bellSlot={
          isManager && partnerId ? (
            <NotificationBell
              partnerId={partnerId}
              onOpenActivity={() => {
                // Will wire to activity tab in a later commit
              }}
            />
          ) : undefined
        }
      />

      {isManager && dashData ? (
        <ManagerView
          roleInfo={roleInfo!}
          dashData={dashData as ManagerDashData}
        />
      ) : dashData ? (
        <MentorView
          roleInfo={roleInfo!}
          dashData={dashData as MentorDashData}
        />
      ) : null}

      <footer className="border-t border-border py-5 text-center">
        <ObfuscatedEmail
          subject="CVLingo Partner Support"
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          Need help? Contact us
        </ObfuscatedEmail>
      </footer>
    </div>
  );
}

export const Route = createFileRoute("/partner/dashboard")({
  codeSplitGroupings: [],
  component: PartnerDashboardPage,
});
