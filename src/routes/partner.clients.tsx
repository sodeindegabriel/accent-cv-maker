import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePartner } from "@/context/PartnerContext";
import type { PartnerPageClient, TeamMember } from "@/components/partner-shared";
import {
  ClientRowActions,
  MentorPicker,
  SkeletonRows,
  SkeletonCards,
  EmptyState,
  ErrorState,
  fmtDate,
  outcomeLabel,
  PAGE_SIZE_DEFAULT,
} from "@/components/partner-shared";

interface ClientSearch {
  filter: string;
  mentor: string;
  q: string;
  page: number;
  pageSize: number;
}

export const Route = createFileRoute("/partner/clients")({
  codeSplitGroupings: [],
  validateSearch: (search: Record<string, unknown>): ClientSearch => ({
    filter: (search.filter as string) ?? "all",
    mentor: (search.mentor as string) ?? "",
    q: (search.q as string) ?? "",
    page: Number(search.page) || 1,
    pageSize: Number(search.pageSize) || PAGE_SIZE_DEFAULT,
  }),
  component: ClientsScreen,
});

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

function ClientsScreen() {
  const { roleInfo, refreshBadges } = usePartner();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const isManager = roleInfo?.is_manager ?? false;

  const [clients, setClients] = useState<PartnerPageClient[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [members, setMembers] = useState<TeamMember[]>([]);

  // Debounced search
  const [debouncedQ, setDebouncedQ] = useState(search.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleQChange(v: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQ(v);
      void navigate({ search: (s: ClientSearch) => ({ ...s, q: v, page: 1 }), replace: true });
    }, 350);
  }

  // Bulk select
  const [selectedRefs, setSelectedRefs] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkMentorId, setBulkMentorId] = useState("");
  const [bulkMentorName, setBulkMentorName] = useState("");
  const [bulkProgress, setBulkProgress] = useState<null | { done: number; total: number }>(null);
  const [bulkSummary, setBulkSummary] = useState<null | { assigned: number; failed: number }>(null);
  const [selectingAll, setSelectingAll] = useState(false);
  const [allMatchingRefs, setAllMatchingRefs] = useState<string[]>([]);

  useEffect(() => {
    if (isManager) {
      void supabase.rpc("list_partner_team", { p_limit: 200, p_offset: 0, p_search: null }).then(({ data }) => {
        const d = data as { rows: TeamMember[]; total: number } | null;
        setMembers(d?.rows ?? []);
      });
    }
  }, [isManager]);

  useEffect(() => {
    const { filter, mentor, page, pageSize } = search;
    void (async () => {
      if (!firstLoad) setClients((c) => c); // keep previous
      setError(null);
      const { data, error: err } = await supabase.rpc("get_partner_clients_page", {
        p_limit: pageSize,
        p_offset: (page - 1) * pageSize,
        p_filter: filter || null,
        p_mentor_user_id: mentor || null,
        p_search: debouncedQ || null,
      });
      setLoading(false);
      setFirstLoad(false);
      if (err) { setError("Could not load clients. Please try again."); return; }
      const d = data as { rows: PartnerPageClient[]; total: number; unassigned_count: number | null };
      setClients(d.rows ?? []);
      setTotal(d.total ?? 0);
      setSelectedRefs(new Set());
      refreshBadges();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.filter, search.mentor, search.page, search.pageSize, debouncedQ, retryCount]);

  const totalPages = Math.ceil(total / search.pageSize);
  const mentorActiveMembers = members.filter((m) => m.status === "active" && m.member_user_id && (m.role === "mentor" || m.role === "owner" || m.role === "manager"));

  function toggleSelect(ref: string) {
    setSelectedRefs((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref); else next.add(ref);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedRefs.size === clients.length) setSelectedRefs(new Set());
    else setSelectedRefs(new Set(clients.map((c) => c.client_ref)));
  }

  async function fetchAllMatchingRefs() {
    setSelectingAll(true);
    const refs: string[] = [];
    let offset = 0;
    while (true) {
      const { data, error: err } = await supabase.rpc("get_partner_clients_page", {
        p_limit: 100, p_offset: offset,
        p_filter: search.filter || null,
        p_mentor_user_id: search.mentor || null,
        p_search: debouncedQ || null,
      });
      if (err || !data) break;
      const d = data as { rows: PartnerPageClient[] };
      refs.push(...d.rows.map((r) => r.client_ref));
      if (d.rows.length < 100) break;
      offset += 100;
    }
    setAllMatchingRefs(refs);
    setSelectedRefs(new Set(refs));
    setSelectingAll(false);
  }

  async function handleBulkAssign() {
    const refs = allMatchingRefs.length > 0 && selectedRefs.size === allMatchingRefs.length
      ? allMatchingRefs
      : Array.from(selectedRefs);
    const BATCH = 200;
    let done = 0; let failed = 0;
    setBulkProgress({ done: 0, total: refs.length });
    for (let i = 0; i < refs.length; i += BATCH) {
      const batch = refs.slice(i, i + BATCH);
      const { error: err } = await supabase.rpc("assign_partner_clients", {
        p_client_refs: batch,
        p_mentor_user_id: bulkMentorId,
      });
      if (err) failed += batch.length; else done += batch.length;
      setBulkProgress({ done: done + failed, total: refs.length });
    }
    setBulkProgress(null);
    setBulkSummary({ assigned: done, failed });
    setBulkConfirm(false);
    setBulkMentorId(""); setBulkMentorName("");
    setSelectedRefs(new Set()); setAllMatchingRefs([]);
    // Refresh list
    const { data } = await supabase.rpc("get_partner_clients_page", {
      p_limit: search.pageSize, p_offset: (search.page - 1) * search.pageSize,
      p_filter: search.filter || null, p_mentor_user_id: search.mentor || null, p_search: debouncedQ || null,
    });
    if (data) {
      const d = data as { rows: PartnerPageClient[]; total: number };
      setClients(d.rows ?? []); setTotal(d.total ?? 0);
    }
    refreshBadges();
  }

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground">
        {roleInfo?.is_manager ? "Clients" : "My clients"}
      </h1>

      {/* Sticky toolbar */}
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap items-center gap-2 bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {/* Filter */}
        {isManager && (
          <select
            value={search.filter}
            onChange={(e) => void navigate({ search: (s: ClientSearch) => ({ ...s, filter: e.target.value, page: 1 }), replace: true })}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary min-h-[44px]"
          >
            <option value="all">All clients</option>
            <option value="unassigned">Unassigned</option>
            <option value="assigned">Assigned</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        )}
        {!isManager && (
          <select
            value={search.filter}
            onChange={(e) => void navigate({ search: (s: ClientSearch) => ({ ...s, filter: e.target.value, page: 1 }), replace: true })}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary min-h-[44px]"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        )}
        {/* Mentor filter (managers only) */}
        {isManager && members.length > 0 && (
          <select
            value={search.mentor}
            onChange={(e) => void navigate({ search: (s: ClientSearch) => ({ ...s, mentor: e.target.value, page: 1 }), replace: true })}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary min-h-[44px]"
          >
            <option value="">All mentors</option>
            {mentorActiveMembers.map((m) => (
              <option key={m.member_id} value={m.member_user_id!}>{m.name || m.email}</option>
            ))}
          </select>
        )}
        {/* Search */}
        <input
          type="search"
          defaultValue={search.q}
          onChange={(e) => handleQChange(e.target.value)}
          placeholder="Search by name or language…"
          className="min-w-[180px] flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary min-h-[44px]"
        />
        {/* Page size */}
        <select
          value={search.pageSize}
          onChange={(e) => void navigate({ search: (s: ClientSearch) => ({ ...s, pageSize: Number(e.target.value), page: 1 }), replace: true })}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary min-h-[44px]"
        >
          {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n} per page</option>)}
        </select>
        {/* Total */}
        <span className="ml-auto text-xs text-muted-foreground">{total.toLocaleString()} client{total !== 1 ? "s" : ""}</span>
      </div>

      {/* Bulk assign summary */}
      {bulkSummary && (
        <div className="mb-4 rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-sm text-foreground">
            Assigned {bulkSummary.assigned} client{bulkSummary.assigned !== 1 ? "s" : ""}
            {bulkSummary.failed > 0 ? ` (${bulkSummary.failed} failed)` : ""}.
          </span>
          <button type="button" onClick={() => setBulkSummary(null)} className="text-xs text-muted-foreground hover:text-foreground min-h-[44px]">Dismiss</button>
        </div>
      )}

      {/* Bulk progress */}
      {bulkProgress && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-sm text-foreground">Assigning… {bulkProgress.done} / {bulkProgress.total}</p>
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Bulk assign toolbar (managers only) */}
      {isManager && selectedRefs.size > 0 && !bulkProgress && (
        <div className="mb-4 rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-foreground">{selectedRefs.size} selected</span>
          {selectedRefs.size === clients.length && total > clients.length && (
            <button type="button" onClick={() => void fetchAllMatchingRefs()} disabled={selectingAll}
              className="text-xs text-primary underline underline-offset-2 hover:no-underline min-h-[44px]">
              {selectingAll ? "Selecting…" : `Select all ${total} matching`}
            </button>
          )}
          <MentorPicker
            members={members}
            value={bulkMentorId}
            onChange={(id, name) => { setBulkMentorId(id); setBulkMentorName(name); }}
            placeholder="Pick mentor to assign…"
          />
          {bulkMentorId && (
            <button type="button" onClick={() => setBulkConfirm(true)}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 min-h-[44px]">
              Assign to {bulkMentorName}
            </button>
          )}
          <button type="button" onClick={() => { setSelectedRefs(new Set()); setAllMatchingRefs([]); }}
            className="text-xs text-muted-foreground hover:text-foreground min-h-[44px]">Clear</button>
        </div>
      )}

      {/* Bulk confirm dialog */}
      {bulkConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="font-semibold text-foreground mb-2">Confirm bulk assignment</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Assign {selectedRefs.size} client{selectedRefs.size !== 1 ? "s" : ""} to <strong>{bulkMentorName}</strong>?
              This will replace any existing mentor assignment.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => void handleBulkAssign()}
                className="flex-1 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 min-h-[44px]">
                Confirm
              </button>
              <button type="button" onClick={() => setBulkConfirm(false)}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted min-h-[44px]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-6 text-center">
          <p className="mb-3 text-sm text-destructive">{error}</p>
          <button type="button" onClick={() => { setLoading(true); setFirstLoad(true); setRetryCount((n) => n + 1); }}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted min-h-[44px]">
            Retry
          </button>
        </div>
      )}

      {/* Table (desktop) */}
      {!error && (
        <>
          <div className="hidden sm:block overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {isManager && (
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox"
                        checked={selectedRefs.size === clients.length && clients.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-border"
                        aria-label="Select all on this page"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Language</th>
                  {isManager && <th className="px-4 py-3 text-left font-medium text-muted-foreground">Mentor</th>}
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {firstLoad && loading ? (
                  <SkeletonRows cols={isManager ? 7 : 5} />
                ) : clients.length === 0 ? (
                  <tr><td colSpan={isManager ? 7 : 5} className="px-4 py-10 text-center text-sm text-muted-foreground">No clients found</td></tr>
                ) : (
                  clients.map((c) => (
                    <ClientRow
                      key={c.client_ref}
                      client={c}
                      isManager={isManager}
                      members={members}
                      selected={selectedRefs.has(c.client_ref)}
                      onToggleSelect={() => toggleSelect(c.client_ref)}
                      onChanged={() => {
                        void supabase.rpc("get_partner_clients_page", {
                          p_limit: search.pageSize, p_offset: (search.page - 1) * search.pageSize,
                          p_filter: search.filter || null, p_mentor_user_id: search.mentor || null, p_search: debouncedQ || null,
                        }).then(({ data }) => {
                          if (data) {
                            const d = data as { rows: PartnerPageClient[]; total: number };
                            setClients(d.rows ?? []); setTotal(d.total ?? 0);
                          }
                        });
                        refreshBadges();
                      }}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="sm:hidden">
            {firstLoad && loading ? (
              <SkeletonCards />
            ) : clients.length === 0 ? (
              <EmptyState message="No clients found" />
            ) : (
              <div className="space-y-3">
                {clients.map((c) => (
                  <MobileClientCard
                    key={c.client_ref}
                    client={c}
                    isManager={isManager}
                    members={members}
                    onChanged={() => {
                      void supabase.rpc("get_partner_clients_page", {
                        p_limit: search.pageSize, p_offset: (search.page - 1) * search.pageSize,
                        p_filter: search.filter || null, p_mentor_user_id: search.mentor || null, p_search: debouncedQ || null,
                      }).then(({ data }) => {
                        if (data) {
                          const d = data as { rows: PartnerPageClient[]; total: number };
                          setClients(d.rows ?? []); setTotal(d.total ?? 0);
                        }
                      });
                      refreshBadges();
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-4">
              <button type="button" disabled={search.page <= 1}
                onClick={() => void navigate({ search: (s: ClientSearch) => ({ ...s, page: s.page - 1 }), replace: true })}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 min-h-[44px]">
                Previous
              </button>
              <span className="text-sm text-muted-foreground">Page {search.page} of {totalPages}</span>
              <button type="button" disabled={search.page >= totalPages}
                onClick={() => void navigate({ search: (s: ClientSearch) => ({ ...s, page: s.page + 1 }), replace: true })}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40 min-h-[44px]">
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ClientRow({ client, isManager, members, selected, onToggleSelect, onChanged }: {
  client: PartnerPageClient;
  isManager: boolean;
  members: TeamMember[];
  selected: boolean;
  onToggleSelect: () => void;
  onChanged: () => void;
}) {
  const [assigning, setAssigning] = useState(false);

  async function handleAssign(userId: string) {
    setAssigning(true);
    await supabase.rpc("assign_partner_clients", {
      p_client_refs: [client.client_ref],
      p_mentor_user_id: userId || null,
    });
    setAssigning(false);
    onChanged();
  }

  return (
    <tr className="border-t border-border hover:bg-muted/30 transition-colors">
      {isManager && (
        <td className="px-4 py-3 w-10">
          <input type="checkbox" checked={selected} onChange={onToggleSelect}
            className="rounded border-border" aria-label={`Select ${client.display_name}`} />
        </td>
      )}
      <td className="px-4 py-3 font-medium text-foreground">{client.display_name}</td>
      <td className="px-4 py-3 text-muted-foreground">{client.language}</td>
      {isManager && (
        <td className="px-4 py-3">
          <MentorPicker
            members={members}
            value={client.mentor_user_id ?? ""}
            onChange={(id) => void handleAssign(id)}
            placeholder="Unassigned"
            disabled={assigning}
          />
        </td>
      )}
      <td className="px-4 py-3">
        {client.case_status === "closed" ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Closed{client.outcome ? ` · ${outcomeLabel(client.outcome)}` : ""}
          </span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Active</span>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{fmtDate(client.joined_at)}</td>
      <td className="px-4 py-3">
        <ClientRowActions client={client} onCaseChanged={onChanged} />
      </td>
    </tr>
  );
}

function MobileClientCard({ client, isManager, members, onChanged }: {
  client: PartnerPageClient;
  isManager: boolean;
  members: TeamMember[];
  onChanged: () => void;
}) {
  const [assigning, setAssigning] = useState(false);

  async function handleAssign(userId: string) {
    setAssigning(true);
    await supabase.rpc("assign_partner_clients", {
      p_client_refs: [client.client_ref],
      p_mentor_user_id: userId || null,
    });
    setAssigning(false);
    onChanged();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-foreground">{client.display_name}</span>
        {client.case_status === "closed" ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground shrink-0">Closed</span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 shrink-0">Active</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{client.language} · Joined {fmtDate(client.joined_at)}</p>
      {isManager && (
        <MentorPicker
          members={members}
          value={client.mentor_user_id ?? ""}
          onChange={(id) => void handleAssign(id)}
          placeholder="Unassigned"
          disabled={assigning}
        />
      )}
      <ClientRowActions client={client} onCaseChanged={onChanged} />
    </div>
  );
}
