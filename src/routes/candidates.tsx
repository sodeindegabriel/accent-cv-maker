import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getCandidatePool, toCSV, type CandidatePoolEntry } from "@/lib/candidatePool";

function CandidatesPage() {
  const [entries, setEntries] = useState<CandidatePoolEntry[]>([]);

  useEffect(() => {
    setEntries(getCandidatePool());
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
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Candidate Pool</h1>
            <p className="text-sm text-muted-foreground">
              {entries.length} {entries.length === 1 ? "candidate" : "candidates"} stored locally on this device.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => download(toCSV(entries), "cvlingo-candidates.csv", "text/csv")}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() =>
                download(JSON.stringify(entries, null, 2), "cvlingo-candidates.json", "application/json")
              }
              className="rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
            >
              Export JSON
            </button>
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No candidates yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Job types</th>
                  <th className="px-3 py-2">Language</th>
                  <th className="px-3 py-2">Right to work</th>
                  <th className="px-3 py-2">City</th>
                  <th className="px-3 py-2">Postcode</th>
                  <th className="px-3 py-2">Referral</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(e.timestamp).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{e.name}</td>
                    <td className="px-3 py-2">{e.email}</td>
                    <td className="px-3 py-2">{e.jobTypes.join(", ")}</td>
                    <td className="px-3 py-2">{e.language}</td>
                    <td className="px-3 py-2">{e.rightToWork}</td>
                    <td className="px-3 py-2">{e.city}</td>
                    <td className="px-3 py-2">{e.referralSource ?? "—"}</td>
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

export const Route = createFileRoute("/candidates")({
  component: CandidatesPage,
  head: () => ({
    meta: [
      { title: "Candidate Pool — CVLingo" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
