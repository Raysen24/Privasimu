"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/router";
import * as XLSX from "xlsx";
import useReviewerRegulations from "../../hooks/useReviewerRegulations";
import { useSearch } from "../../contexts/SearchContext";

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

const Chip = ({ active, children, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-sm border transition ${
      active ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
    }`}
  >
    {children}
  </button>
);

export default function ReviewerRegulationsList() {
  const router = useRouter();
  const { searchTerm } = useSearch();
  const { regulations, loading, error } = useReviewerRegulations();

  const [bucketFilter, setBucketFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("deadline");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const categories = useMemo(() => {
    const set = new Set();
    regulations.forEach((r) => r.category && set.add(r.category));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [regulations]);

  const filtered = useMemo(() => {
    const term = (searchTerm || "").trim().toLowerCase();
    let rows = term
      ? regulations.filter((r) => {
          const hay = [r.title, r.ref, r.category, r.displayStatus, r.feedbackLabel].filter(Boolean).join(" ").toLowerCase();
          return hay.includes(term);
        })
      : regulations;

    if (bucketFilter !== "all") rows = rows.filter((r) => r.statusBucket === bucketFilter);
    if (categoryFilter !== "all") rows = rows.filter((r) => r.category === categoryFilter);

    if (sortBy === "deadline") {
      rows = [...rows].sort((a, b) => {
        const ad = a.deadlineDate ? a.deadlineDate.getTime() : Number.POSITIVE_INFINITY;
        const bd = b.deadlineDate ? b.deadlineDate.getTime() : Number.POSITIVE_INFINITY;
        if (ad !== bd) return ad - bd;
        const au = a.updatedAtDate ? a.updatedAtDate.getTime() : 0;
        const bu = b.updatedAtDate ? b.updatedAtDate.getTime() : 0;
        return bu - au;
      });
    } else if (sortBy === "updated") {
      rows = [...rows].sort((a, b) => {
        const au = a.updatedAtDate ? a.updatedAtDate.getTime() : 0;
        const bu = b.updatedAtDate ? b.updatedAtDate.getTime() : 0;
        return bu - au;
      });
    } else if (sortBy === "title") {
      rows = [...rows].sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
    }

    return rows;
  }, [regulations, searchTerm, bucketFilter, categoryFilter, sortBy]);

  const counts = useMemo(() => {
    const c = { needs_review: 0, rejected: 0, pending_admin: 0, completed: 0 };
    regulations.forEach((r) => {
      if (r.statusBucket in c) c[r.statusBucket] += 1;
    });
    return c;
  }, [regulations]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  // Reset pagination when filters change
  React.useEffect(() => {
    setPage(1);
  }, [bucketFilter, categoryFilter, sortBy, searchTerm]);

  const exportToExcel = () => {
    const data = filtered.map((r) => ({
      Title: r.title || "-",
      Reference: r.ref,
      Category: r.category || "-",
      Status: r.displayStatus,
      Deadline: r.deadlineLabel,
      Feedback: r.feedbackLabel,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reviewer Regulations");
    XLSX.writeFile(wb, "reviewer_regulations.xlsx");
  };

  const actionFor = (r) => {
    if (r.statusBucket === "needs_review") return { label: "Review", href: `/reviewer/regulations/${r.id}` };
    if (r.statusBucket === "rejected") return { label: "Edit feedback", href: `/reviewer/feedback/${r.id}` };
    if (r.statusBucket === "pending_admin") return { label: "Pending", href: null };
    if (r.statusBucket === "completed") return { label: "Done", href: null };
    return { label: "View", href: `/reviewer/regulations/${r.id}` };
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-6 w-56 bg-gray-200 rounded" />
            <div className="h-10 bg-gray-100 rounded" />
            <div className="h-64 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-white border border-red-200 rounded-lg p-6">
          <h1 className="text-lg font-semibold text-gray-900">Couldn’t load regulations</h1>
          <p className="text-sm text-gray-600 mt-1">Check your Firestore rules and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Regulations</h1>
          <p className="text-gray-500">
            Filter and sort all documents. Global search (top bar) also applies here.
          </p>
        </div>
        <button
          onClick={exportToExcel}
          className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium"
        >
          Export
        </button>
      </div>

      {/* Quick chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Chip active={bucketFilter === "all"} onClick={() => setBucketFilter("all")}>All</Chip>
        <Chip active={bucketFilter === "needs_review"} onClick={() => setBucketFilter("needs_review")}>
          Needs review ({counts.needs_review})
        </Chip>
        <Chip active={bucketFilter === "rejected"} onClick={() => setBucketFilter("rejected")}>
          Rejected ({counts.rejected})
        </Chip>
        <Chip active={bucketFilter === "pending_admin"} onClick={() => setBucketFilter("pending_admin")}>
          Pending admin ({counts.pending_admin})
        </Chip>
        <Chip active={bucketFilter === "completed"} onClick={() => setBucketFilter("completed")}>
          Completed ({counts.completed})
        </Chip>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Category</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm border border-gray-300 bg-white"
            >
              <option value="all">All</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm border border-gray-300 bg-white"
            >
              <option value="deadline">Deadline (soonest)</option>
              <option value="updated">Recently updated</option>
              <option value="title">Title (A–Z)</option>
            </select>
          </div>

          <div className="md:ml-auto text-sm text-gray-500">
            Showing <span className="font-medium text-gray-700">{filtered.length}</span> results
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left text-gray-700">
            <thead className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase">
              <tr>
                <th className="px-6 py-3">Title</th>
                <th className="px-6 py-3">Reference</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Deadline</th>
                <th className="px-6 py-3">Feedback</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                    No results.
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => {
                  const a = actionFor(r);
                  const overdue = r.deadlineDate ? r.deadlineDate < new Date() : false;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 max-w-[380px]">
                        <button
                          className="text-left text-blue-700 hover:underline font-medium truncate max-w-[360px]"
                          title={r.title}
                          onClick={() => router.push(`/reviewer/regulations/${r.id}`)}
                        >
                          {r.title || "-"}
                        </button>
                        <div className="text-xs text-gray-500 mt-1">{r.category || "—"}</div>
                      </td>
                      <td className="px-6 py-4">{r.ref}</td>
                      <td className="px-6 py-4">
                        <StatusPill bucket={r.statusBucket} label={r.displayStatus} />
                      </td>
                      <td className={`px-6 py-4 ${overdue ? "text-red-600 font-medium" : ""}`}>{r.deadlineLabel}</td>
                      <td className="px-6 py-4 text-gray-600 max-w-[260px] truncate" title={r.feedbackLabel}>
                        {r.feedbackLabel}
                      </td>
                      <td className="px-6 py-4">
                        {a.href ? (
                          <button
                            onClick={() => router.push(a.href)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {a.label}
                          </button>
                        ) : (
                          <span className="text-sm font-medium text-gray-400">{a.label}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-3 text-xs text-gray-500 border-t border-gray-200 flex items-center justify-between">
          <span>
            Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
          </span>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <button
              className="px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
