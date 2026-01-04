import React from "react";

function formatTimestamp(ts) {
  try {
    if (!ts) return "";
    // Firestore Timestamp
    if (typeof ts.toDate === "function") {
      return ts.toDate().toLocaleString();
    }
    // Firestore Timestamp JSON ({ seconds, nanoseconds } or { _seconds, _nanoseconds })
    const seconds =
      typeof ts === "object" && ts
        ? ts.seconds ?? ts._seconds
        : undefined;
    if (typeof seconds === "number") {
      return new Date(seconds * 1000).toLocaleString();
    }

    // ISO string / Date
    const d = ts instanceof Date ? ts : new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  } catch {
    return "";
  }
}

function getActorId(entry) {
  return (
    entry?.actorId ||
    entry?.userId ||
    entry?.by ||
    entry?.actor?.uid ||
    entry?.actor?.id ||
    null
  );
}

function getActorRole(entry) {
  return (
    entry?.actorRole ||
    entry?.role ||
    entry?.actor?.role ||
    (entry?.action?.includes("admin") ? "admin" : null) ||
    (entry?.action?.includes("review") ? "reviewer" : null) ||
    "user"
  );
}

function getNote(entry) {
  return entry?.note || entry?.comment || entry?.details || "";
}

const ACTION_LABELS = {
  created: "Created",
  updated: "Updated",
  revised: "Revised",
  submitted: "Submitted for review",
  resubmitted: "Resubmitted for review",
  review_approved: "Approved by reviewer",
  review_rejected: "Rejected by reviewer",
  reviewer_approved: "Approved by reviewer",
  reviewer_rejected: "Rejected by reviewer",
  admin_published: "Published by admin",
  published: "Published",
  admin_rejected: "Rejected by admin",
  admin_requested_revision: "Revision requested by admin",
  assigned_reviewer: "Reviewer assigned",
  feedback_updated: "Reviewer feedback submitted",
};

export default function ProgressTracker({ history = [], createdBy }) {
  const items = Array.isArray(history) ? [...history] : [];
  items.sort((a, b) => {
    const ta = a?.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a?.timestamp || 0).getTime();
    const tb = b?.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b?.timestamp || 0).getTime();
    return ta - tb;
  });

  // If a regulation has no history yet, still show who created it.
  const hasHistory = items.length > 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800">Progress Tracker</h3>
      {!hasHistory && (
        <div className="mt-3 text-sm text-gray-600">
          <div>
            <span className="font-medium">Created by (Employee ID): </span>
            <span className="font-mono">{createdBy || "—"}</span>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            No progress entries yet.
          </div>
        </div>
      )}

      {hasHistory && (
        <ol className="mt-4 space-y-4">
          {items.map((entry, idx) => {
            const label = ACTION_LABELS[entry?.action] || entry?.action || "Activity";
            const actorId = getActorId(entry);
            const actorRole = getActorRole(entry);
            const note = getNote(entry);
            const time = formatTimestamp(entry?.timestamp);

            return (
              <li key={idx} className="flex gap-3">
                <div className="mt-2 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                <div className="flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <div className="font-medium text-gray-900">{label}</div>
                    {time && <div className="text-xs text-gray-500">{time}</div>}
                  </div>
                  <div className="mt-1 text-sm text-gray-700">
                    <span className="capitalize">{actorRole}</span>
                    {actorId ? (
                      <>
                        {" "}ID: <span className="font-mono">{actorId}</span>
                      </>
                    ) : (
                      <> ID: <span className="font-mono">—</span></>
                    )}
                  </div>
                  {note && (
                    <div className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">{note}</div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
