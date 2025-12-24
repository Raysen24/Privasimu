"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
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

export default function ReviewRegulationReviewer() {
  const router = useRouter();
  const { id } = router.query;
  const { user, isReviewer, isLoading } = useAuth();

  const [reg, setReg] = useState(null);
  const [loadingReg, setLoadingReg] = useState(true);
  const [notes, setNotes] = useState("");
  const [revisionDeadline, setRevisionDeadline] = useState("");
  const [decision, setDecision] = useState(null); // 'approve' | 'deny'
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
        setNotes((data.feedback && String(data.feedback)) || "");
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
      effectiveDate: fmtDDMMYY(reg.effectiveDate),
      deadline: fmtDDMMYY(reg.deadline),
      ref: reg.ref || reg.refNumber || "-",
      status: reg.status || "-",
    };
  }, [reg]);

  const confirmCopy = decision === "approve"
    ? "Click Confirm to Approve the Regulation"
    : "Click Confirm to Deny the Regulation";

  const handleSubmit = () => {
    if (!decision) return;
    
    // Require revision deadline when denying
    if (decision === "deny" && !revisionDeadline) {
      alert("Please set a revision deadline before denying the regulation.");
      return;
    }
    
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (!id || !decision || !user?.uid) return;
    
    // Require revision deadline when denying
    if (decision === "deny" && !revisionDeadline) {
      alert("Please set a revision deadline before denying the regulation.");
      setShowConfirm(false);
      return;
    }
    
    setSaving(true);
    try {
      const nextStatus = decision === "approve" ? "Pending Publish" : "Needs Revision";
      const ref = doc(db, "regulations", id);

      const updateData = {
        status: nextStatus,
        feedback: notes || "",
        reviewedAt: serverTimestamp(),
        reviewedBy: user.uid,
        reviewerName: user.name || user.email || "Reviewer",
        updatedAt: serverTimestamp(),
      };

      // Add revision deadline if denying
      if (decision === "deny" && revisionDeadline) {
        const deadlineDate = new Date(revisionDeadline);
        updateData.revisionDeadline = deadlineDate;
      }

      await updateDoc(ref, updateData);

      setShowConfirm(false);
      router.push("/dashboard/reviewer");
    } catch (e) {
      console.error(e);
      alert("Failed to submit review.");
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
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-700">
          <span className="font-medium">Category</span> : {header.category}
          {reg.status !== 'Published' && reg.deadline && (
            <>
              <span className="mx-6" />
              <span className="font-medium">Admin Deadline</span> : {header.deadline}
            </>
          )}
          {reg.revisionDeadline && (
            <>
              <span className="mx-6" />
              <span className="font-medium text-blue-700">Revision Deadline</span> : {fmtDDMMYY(reg.revisionDeadline)}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left content */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-6">
          <div className="space-y-2 text-sm text-gray-700 mb-4">
            <div>
              <span className="font-medium">Regulation Code</span> : {header.code}
            </div>
            <div>
              <span className="font-medium">Effective Date</span> : {header.effectiveDate}
            </div>
          </div>

          {reg.description ? (
            <div
              className="prose max-w-none text-gray-800"
              dangerouslySetInnerHTML={{ __html: reg.description }}
            />
          ) : (
            <div className="text-gray-500 text-sm">No content.</div>
          )}

          {/* Employee Notes */}
          {reg.notes && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Employee Notes</h3>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                {reg.notes}
              </div>
            </div>
          )}

          {/* Revision Deadline - Show if reviewer assigned one */}
          {reg.revisionDeadline && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-800 mb-1">Revision Deadline (Assigned by You)</h3>
                <p className="text-sm font-semibold text-blue-900">
                  {fmtDDMMYY(reg.revisionDeadline)}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Employee must revise by this date
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right actions */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="font-semibold text-gray-900 mb-4">Actions</div>

          <div className="flex gap-3 mb-4">
            <button
              type="button"
              onClick={() => setDecision("deny")}
              className={`px-4 py-2 rounded-md text-sm font-medium border ${
                decision === "deny"
                  ? "bg-red-600 text-white border-red-600"
                  : "bg-white text-red-600 border-red-300 hover:bg-red-50"
              }`}
            >
              Deny
            </button>
            <button
              type="button"
              onClick={() => setDecision("approve")}
              className={`px-4 py-2 rounded-md text-sm font-medium border ${
                decision === "approve"
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-green-600 border-green-300 hover:bg-green-50"
              }`}
            >
              Approve
            </button>
          </div>

          <div className="mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Notes</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add Comment Here:"
              className="w-full h-40 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Revision Deadline - Only show when denying */}
          {decision === "deny" && (
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Revision Deadline <span className="text-red-600">*</span>
              </div>
              <input
                type="datetime-local"
                value={revisionDeadline}
                onChange={(e) => setRevisionDeadline(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min={new Date().toISOString().slice(0, 16)}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Required when denying. Employee must revise by this date.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!decision || saving}
            className="w-full bg-blue-900 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-950 disabled:opacity-50"
          >
            {saving ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-[360px] p-6 text-center">
            <div className="font-semibold text-gray-900 mb-6">{confirmCopy}</div>
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
