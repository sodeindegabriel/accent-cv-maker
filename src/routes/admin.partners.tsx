import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

type PartnerEntry = {
  orgName: string;
  orgType: string;
  orgTypeOther: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  website: string;
  memberCount: string;
  referralSource: string;
  timestamp: string;
};

const STORAGE_KEY = "cvlingo:partners";

function getPartners(): PartnerEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PartnerEntry[]) : [];
  } catch {
    return [];
  }
}

function toCSV(entries: PartnerEntry[]): string {
  const headers = [
    "timestamp",
    "orgName",
    "orgType",
    "name",
    "email",
    "phone",
    "website",
    "memberCount",
    "referralSource",
  ];
  const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const rows = entries.map((e) => {
    const type =
      e.orgType === "Other" && e.orgTypeOther ? `Other — ${e.orgTypeOther}` : e.orgType;
    return [
      e.timestamp,
      e.orgName,
      type,
      e.name,
      e.email,
      e.phone,
      e.website,
      e.memberCount,
      e.referralSource,
    ]
      .map((v) => escape(String(v ?? "")))
      .join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

function AdminPartnersPage() {
  const [entries, setEntries] = useState<PartnerEntry[]>([]);

  useEffect(() => {
    setEntries(getPartners());
  }, []);

  const download = (data: string, filename: string, type: string) => {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Community Partner Applications</h1>
            <p className="text-sm text-muted-foreground">
              {entries.length} {entries.length === 1 ? "application" : "applications"} stored
              locally on this device.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => download(toCSV(entries), "cvlingo-partners.csv", "text/csv")}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() =>
                download(JSON.stringify(entries, null, 2), "cvlingo-partners.json", "application/json")
              }
              className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
            >
              Export JSON
            </button>
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No partner applications yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Date submitted</th>
                  <th className="px-3 py-2">Organisation</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Contact name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Website</th>
                  <th className="px-3 py-2">Members</th>
                  <th className="px-3 py-2">Heard via</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i} className="border-t border-border align-top">
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {new Date(e.timestamp).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{e.orgName}</td>
                    <td className="px-3 py-2">
                      {e.orgType === "Other" && e.orgTypeOther
                        ? `Other — ${e.orgTypeOther}`
                        : e.orgType}
                    </td>
                    <td className="px-3 py-2">
                      {e.name}
                      {e.role ? <span className="block text-xs text-muted-foreground">{e.role}</span> : null}
                    </td>
                    <td className="px-3 py-2">{e.email}</td>
                    <td className="px-3 py-2">{e.phone || "—"}</td>
                    <td className="px-3 py-2">
                      {e.website ? (
                        <a
                          href={e.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline"
                        >
                          {e.website}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">{e.memberCount || "—"}</td>
                    <td className="px-3 py-2">{e.referralSource || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

export const Route = createFileRoute("/admin/partners")({
  component: AdminPartnersPage,
  head: () => ({
    meta: [
      { title: "Partner Applications — CVLingo Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
