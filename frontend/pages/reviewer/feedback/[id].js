"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../contexts/AuthContext";
import Unauthorized from "../../../components/common/Unauthorized";
import LoadingSpinner from "../../../components/common/LoadingSpinner";

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value?._seconds) return new Date(value._seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const fmtDDMMYY = (value) => {
  const d = toDate(value);
  if (!d) return "-";
  const dd = d.getDate();
  const mm = d.getMonth() + 1;
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
};

const toDateInputValue = (value) => {
  const d = toDate(value);
  if (!d) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function EditFeedbackReviewer() {
  const router = useRouter();
  const { id } = router.query;
  const { user, isReviewer, isLoading } = useAuth();

  const [reg, setReg] = useState(null);
  const [loadingReg, setLoadingReg] = useState(true);
  const [deadline, setDeadline] = useState("");
  const [revisionDeadline, setRevisionDeadline] = useState("");
  const [feedback, setFeedback] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        setLoadingReg(true);
        const ref = doc(db, "regulations", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          setError("Regulation not found.");
          setReg(null);
          return;
        }
        const data = { id: snap.id, ...snap.data() };
        setReg(data);
        setDeadline(toDateInputValue(data.deadline));
        setRevisionDeadline(toDateInputValue(data.revisionDeadline));
        setFeedback((data.feedback && String(data.feedback)) || "");
      } catch (e) {
        console.error(e);
        setError("Failed to load regulation.");
      } finally {
        setLoadingReg(false);
      }
    };
    load();
  }, [id]);

  const header = useMemo(() => {
    if (!reg) return null;
    return {
      category: reg.category || "-",
      code: reg.code || reg.regulationCode || "-",
      status: reg.status || "Rejected",
      deadlinePretty: fmtDDMMYY(reg.deadline),
    };
  }, [reg]);

  const handleSubmit = () => setShowConfirm(true);

  const handleConfirm = async () => {
    if (!id || !user?.uid) return;
    setSaving(true);
    try {
      const ref = doc(db, "regulations", id);
      const deadlineDate = deadline ? new Date(deadline) : null;
      await updateDoc(ref, {
        feedback: feedback || "",
        deadline: deadlineDate,
        updatedAt: serverTimestamp(),
        feedbackUpdatedAt: serverTimestamp(),
        feedbackUpdatedBy: user.uid,
      });
      setShowConfirm(false);
      router.push("/dashboard/reviewer");
    } catch (e) {
      console.error(e);
      alert("Failed to save feedback.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || loadingReg) return <LoadingSpinner />;
  if (!user) return <LoadingSpinner />;
  if (!isReviewer()) return <Unauthorized />;

  if (error || !reg) {
    return (
      <div className="p-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="text-red-600">{error || "Regulation not found."}</div>
          <button
            className="mt-4 px-4 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50"
            onClick={() => router.push("/reviewer/regulations")}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left content */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-6">
          <div className="space-y-2 text-sm text-gray-700 mb-4">
            <div>
              <span className="font-medium">Category</span> : {header.category}
            </div>
            <div>
              <span className="font-medium">Reference Code</span> : {reg.ref || reg.refNumber || "-"}
            </div>
            {reg.deadline && (
              <div>
                <span className="font-medium">Admin Deadline</span> : {header.deadlinePretty}
              </div>
            )}
          </div>

          {reg.description ? (
            <div
              className="prose max-w-none text-gray-800"
              dangerouslySetInnerHTML={{ __html: reg.description }}
            />
          ) : (
            <div className="text-gray-500 text-sm">No content.</div>
          )}

          {/* Employee Notes - Hide for published regulations */}
          {(() => {
            const status = reg?.status?.toLowerCase() || "";
            const isPublished = status === "published" || status === "publish";
            
            if (isPublished) return null;
            
            return reg.notes ? (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Employee Notes</h3>
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                  {reg.notes}
                </div>
              </div>
            ) : null;
          })()}

          {/* Attachments */}
          {Array.isArray(reg.attachments) && reg.attachments.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Attachments</h3>
              <div className="bg-white border border-gray-200 rounded-lg divide-y">
                {reg.attachments.map((attachment, index) => (
                  <div
                    key={`${attachment.url}-${index}`}
                    className="flex items-center justify-between px-4 py-3 text-sm text-gray-700"
                  >
                    <div>
                      <p className="font-medium">{attachment.name || `Attachment ${index + 1}`}</p>
                      <p className="text-xs text-gray-500 truncate max-w-sm">{attachment.url}</p>
                    </div>
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm font-medium"
                    >
                      Open
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right card */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Status</div>
            <span className="inline-flex px-3 py-1 rounded bg-red-600 text-white text-xs font-semibold">
              Rejected
            </span>
          </div>

          {/* Revision Deadline - Hide for published regulations */}
          {(() => {
            const status = reg?.status?.toLowerCase() || "";
            const isPublished = status === "published" || status === "publish";
            
            if (isPublished) return null;
            
            return reg.revisionDeadline ? (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-medium text-blue-800 mb-1">Revision Deadline (Assigned by You)</div>
                <div className="text-sm font-semibold text-blue-900">
                  {fmtDDMMYY(reg.revisionDeadline)}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  Employee must revise by this date
                </div>
              </div>
            ) : null;
          })()}

          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Deadline</div>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <div className="mt-1 text-xs text-gray-500">Current: {header.deadlinePretty}</div>
          </div>

          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Edit Feedback:</div>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Add Comment Here:"
              className="w-full h-44 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-blue-900 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-950 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Submit"}
          </button>
        </div>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-[360px] p-6 text-center">
            <div className="font-semibold text-gray-900 mb-6">Click Confirm to Save Changes</div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-6 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium hover:bg-gray-50"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="px-6 py-2 rounded-md bg-blue-900 text-white text-sm font-medium"
                disabled={saving}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
