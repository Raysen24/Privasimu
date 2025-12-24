"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/router";
import useReviewerRegulations, { fmtShortDate } from "../../hooks/useReviewerRegulations";
import { useSearch } from "../../contexts/SearchContext";

// --- small UI helpers (keeps same theme as Employee dashboard) ---
const IconCircle = ({ children, tone = "blue" }) => {
  const tones = {
    blue: "bg-blue-100 text-blue-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700",
    green: "bg-green-100 text-green-700",
    gray: "bg-gray-100 text-gray-700",
  };
  return (
    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${tones[tone] || tones.blue}`}>{children}</div>
  );
};

const Card = ({ title, subtitle, value, icon, tone = "blue" }) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subtitle ? <p className="text-xs text-gray-500 mt-1">{subtitle}</p> : null}
      </div>
      <IconCircle tone={tone}>{icon}</IconCircle>
    </div>
  </div>
);

const StatusPill = ({ bucket, label }) => {
  const cls =
    bucket === "needs_review"
      ? "bg-yellow-100 text-yellow-800"
      : bucket === "rejected"
      ? "bg-red-100 text-red-800"
      : bucket === "pending_admin"
      ? "bg-orange-100 text-orange-800"
      : bucket === "completed"
      ? "bg-green-100 text-green-800"
      : "bg-gray-100 text-gray-800";
  return <span className={`px-2 py-1 text-xs font-medium rounded ${cls}`}>{label}</span>;
};

// Inline icons (no extra deps)
const ClipboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M9 12h6" />
    <path d="M9 16h6" />
  </svg>
);

const AlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

const HourglassIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
    <path d="M5 22h14" />
    <path d="M5 2h14" />
    <path d="M17 2v6a5 5 0 0 1-5 5 5 5 0 0 1-5-5V2" />
    <path d="M7 22v-6a5 5 0 0 1 5-5 5 5 0 0 1 5 5v6" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export default function ReviewerDashboard() {
  const router = useRouter();
  const { searchTerm } = useSearch();
  const { regulations, loading, error } = useReviewerRegulations();

  const filtered = useMemo(() => {
    const term = (searchTerm || "").trim().toLowerCase();
    if (!term) return regulations;
    return regulations.filter((r) => {
      const hay = [r.title, r.ref, r.category, r.displayStatus, r.feedbackLabel].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [regulations, searchTerm]);

  const counts = useMemo(() => {
    const c = { needs_review: 0, rejected: 0, in_revision: 0, pending_admin: 0, completed: 0 };
    for (const r of filtered) {
      if (r.statusBucket in c) c[r.statusBucket] += 1;
    }
    return c;
  }, [filtered]);

  const queue = useMemo(() => {
    // Things the reviewer can act on now (includes regulations in revision so reviewer can track progress)
    return filtered
      .filter((r) => r.statusBucket === "needs_review" || r.statusBucket === "rejected" || r.statusBucket === "in_revision")
      .sort((a, b) => {
        // prioritize earliest deadlines; no deadline goes last
        const ad = a.deadlineDate ? a.deadlineDate.getTime() : Number.POSITIVE_INFINITY;
        const bd = b.deadlineDate ? b.deadlineDate.getTime() : Number.POSITIVE_INFINITY;
        if (ad !== bd) return ad - bd;
        const au = a.updatedAtDate ? a.updatedAtDate.getTime() : 0;
        const bu = b.updatedAtDate ? b.updatedAtDate.getTime() : 0;
        return bu - au;
      })
      .slice(0, 6);
  }, [filtered]);

  const deadlines = useMemo(() => {
    const now = new Date();
    const rows = filtered
      .filter((r) => {
        // Use revision deadline if available for rejected/in_revision, otherwise regular deadline
        const deadlineToUse = (r.statusBucket === 'rejected' || r.statusBucket === 'in_revision') && r.revisionDeadlineDate
          ? r.revisionDeadlineDate
          : r.deadlineDate;
        if (!deadlineToUse) return false;
        const status = String(r.status || '').toLowerCase().trim();
        const isPub = status === 'published' || status === 'publish' || r.statusBucket === 'completed';
        return !isPub;
      })
      .map((r) => {
        // Use revision deadline if available for rejected/in_revision, otherwise regular deadline
        const deadlineToUse = (r.statusBucket === 'rejected' || r.statusBucket === 'in_revision') && r.revisionDeadlineDate
          ? r.revisionDeadlineDate
          : r.deadlineDate;
        return { 
          id: r.id, 
          ref: r.ref, 
          title: r.title, 
          when: deadlineToUse, 
          bucket: r.statusBucket,
          isRevisionDeadline: (r.statusBucket === 'rejected' || r.statusBucket === 'in_revision') && !!r.revisionDeadlineDate
        };
      });
    const overdue = rows.filter((r) => r.when < now).sort((a, b) => a.when - b.when).slice(0, 5);
    const upcoming = rows
      .filter((r) => r.when >= now)
      .sort((a, b) => a.when - b.when)
      .slice(0, 5);
    return { overdue, upcoming };
  }, [filtered]);

  const reviewNext = useMemo(() => {
    // Prefer items needing review; otherwise rejected needing feedback updates
    const byDeadline = (a, b) => {
      const ad = a.deadlineDate ? a.deadlineDate.getTime() : Number.POSITIVE_INFINITY;
      const bd = b.deadlineDate ? b.deadlineDate.getTime() : Number.POSITIVE_INFINITY;
      return ad - bd;
    };
    const needs = filtered.filter((r) => r.statusBucket === "needs_review").sort(byDeadline)[0];
    if (needs) return { id: needs.id, route: `/reviewer/regulations/${needs.id}` };
    const rej = filtered.filter((r) => r.statusBucket === "rejected").sort(byDeadline)[0];
    if (rej) return { id: rej.id, route: `/reviewer/feedback/${rej.id}` };
    return null;
  }, [filtered]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-56 bg-gray-200 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="h-24 bg-gray-100 rounded" />
              <div className="h-24 bg-gray-100 rounded" />
              <div className="h-24 bg-gray-100 rounded" />
              <div className="h-24 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-white border border-red-200 rounded-lg p-6">
          <h1 className="text-lg font-semibold text-gray-900">Couldn’t load reviewer data</h1>
          <p className="text-sm text-gray-600 mt-1">Check your Firestore rules and network connection.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reviewer Dashboard</h1>
          <p className="text-gray-500">Focus on what needs your action now. Use Regulations for the full list and filters.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/reviewer/regulations")}
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium"
          >
            Open Regulations
          </button>
          <button
            disabled={!reviewNext}
            onClick={() => reviewNext && router.push(reviewNext.route)}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${
              reviewNext ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-300 cursor-not-allowed"
            }`}
          >
            Review next
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card
          title="Needs review"
          subtitle="Documents waiting for you"
          value={counts.needs_review}
          tone="yellow"
          icon={<ClipboardIcon />}
        />
        <Card
          title="Rejected"
          subtitle="Needs feedback updates"
          value={counts.rejected}
          tone="red"
          icon={<AlertIcon />}
        />
        <Card
          title="Pending admin"
          subtitle="Waiting for admin decision"
          value={counts.pending_admin}
          tone="blue"
          icon={<HourglassIcon />}
        />
        <Card
          title="Completed"
          subtitle="Already processed"
          value={counts.completed}
          tone="green"
          icon={<CheckIcon />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Queue */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Your queue</h2>
              <p className="text-sm text-gray-500">Top items that you can act on right now.</p>
            </div>
            <button
              onClick={() => router.push("/reviewer/regulations")}
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              View all
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left text-gray-700">
              <thead className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase">
                <tr>
                  <th className="px-6 py-3">Title</th>
                  <th className="px-6 py-3">Ref</th>
                  <th className="px-6 py-3">Deadline</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {queue.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-6 text-gray-500 text-center">
                      Nothing urgent right now.
                    </td>
                  </tr>
                ) : (
                  queue.map((r) => {
                    const overdue = r.deadlineDate ? r.deadlineDate < new Date() : false;
                    const actionLabel = r.statusBucket === "needs_review" ? "Review" : "Edit feedback";
                    const actionHref = r.statusBucket === "needs_review" ? `/reviewer/regulations/${r.id}` : `/reviewer/feedback/${r.id}`;
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 max-w-[380px] truncate" title={r.title}>
                          {r.title || "-"}
                        </td>
                        <td className="px-6 py-4">{r.ref}</td>
                        <td className={`px-6 py-4 ${overdue ? "text-red-600 font-medium" : ""}`}>
                        {(() => {
                          const status = String(r.status || '').toLowerCase().trim();
                          const isPub = status === 'published' || status === 'publish' || r.statusBucket === 'completed';
                          if (isPub) return '—';
                          
                          const hasRevisionDeadline = r.revisionDeadlineLabel && (r.statusBucket === 'rejected' || r.statusBucket === 'in_revision');
                          const hasRegularDeadline = r.deadlineLabel && r.deadlineLabel !== '-';
                          
                          // Show both deadlines if both exist
                          if (hasRevisionDeadline && hasRegularDeadline) {
                            const revOverdue = r.revisionDeadlineDate ? r.revisionDeadlineDate < new Date() : false;
                            const regOverdue = r.deadlineDate ? r.deadlineDate < new Date() : false;
                            return (
                              <div className="flex flex-col gap-1">
                                <div className="flex flex-col">
                                  <span className={regOverdue ? "text-red-600 font-medium" : "text-gray-700"}>
                                    {r.deadlineLabel}
                                  </span>
                                  <span className="text-xs text-gray-500">(Admin)</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className={revOverdue ? "text-red-600 font-medium" : "text-blue-700 font-medium"}>
                                    {r.revisionDeadlineLabel}
                                  </span>
                                  <span className="text-xs text-blue-600">(Revision)</span>
                                </div>
                              </div>
                            );
                          }
                          
                          // Show revision deadline if it exists
                          if (hasRevisionDeadline) {
                            const revOverdue = r.revisionDeadlineDate ? r.revisionDeadlineDate < new Date() : false;
                            return (
                              <div className="flex flex-col">
                                <span className={revOverdue ? "text-red-600 font-medium" : "text-blue-700 font-medium"}>
                                  {r.revisionDeadlineLabel}
                                </span>
                                <span className="text-xs text-blue-600">(Revision)</span>
                              </div>
                            );
                          }
                          
                          // Show regular deadline
                          if (hasRegularDeadline) {
                            return (
                              <div className="flex flex-col">
                                <span className={overdue ? "text-red-600 font-medium" : "text-gray-700"}>
                                  {r.deadlineLabel}
                                </span>
                                <span className="text-xs text-gray-500">(Admin)</span>
                              </div>
                            );
                          }
                          
                          return '-';
                        })()}
                      </td>
                        <td className="px-6 py-4">
                          <StatusPill bucket={r.statusBucket} label={r.displayStatus} />
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => router.push(actionHref)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {actionLabel}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Deadlines */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Deadlines</h2>
            <p className="text-sm text-gray-500">Quick glance at upcoming and overdue items.</p>
          </div>

          <div className="px-6 py-4">
            <div className="text-sm font-semibold text-red-600 mb-2">Overdue</div>
            <ul className="space-y-2">
              {deadlines.overdue.length === 0 ? (
                <li className="text-sm text-gray-400">—</li>
              ) : (
                deadlines.overdue.map((d) => (
                  <li key={d.id} className="flex items-start justify-between gap-3">
                    <button
                      onClick={() =>
                        router.push(d.bucket === "rejected" ? `/reviewer/feedback/${d.id}` : `/reviewer/regulations/${d.id}`)
                      }
                      className="text-left text-sm text-gray-800 hover:text-blue-700 hover:underline max-w-[14rem] truncate"
                      title={d.title}
                    >
                      {d.ref} · {d.title || "Untitled"}
                    </button>
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-red-600 font-medium">{fmtShortDate(d.when)}</span>
                      {d.isRevisionDeadline && <span className="text-xs text-blue-600">(Rev)</span>}
                    </div>
                  </li>
                ))
              )}
            </ul>

            <div className="text-sm font-semibold text-orange-600 mt-6 mb-2">Upcoming</div>
            <ul className="space-y-2">
              {deadlines.upcoming.length === 0 ? (
                <li className="text-sm text-gray-400">—</li>
              ) : (
                deadlines.upcoming.map((d) => (
                  <li key={d.id} className="flex items-start justify-between gap-3">
                    <button
                      onClick={() =>
                        router.push(d.bucket === "rejected" ? `/reviewer/feedback/${d.id}` : `/reviewer/regulations/${d.id}`)
                      }
                      className="text-left text-sm text-gray-800 hover:text-blue-700 hover:underline max-w-[14rem] truncate"
                      title={d.title}
                    >
                      {d.ref} · {d.title || "Untitled"}
                    </button>
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-gray-600">{fmtShortDate(d.when)}</span>
                      {d.isRevisionDeadline && <span className="text-xs text-blue-600">(Rev)</span>}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
