import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'

// --- helpers ---
export const toDate = (value) => {
  if (!value) return null
  try {
    // Firestore Timestamp
    if (typeof value?.toDate === 'function') return value.toDate()
    // Some exports use {_seconds}
    if (value?._seconds && typeof value._seconds === 'number') return new Date(value._seconds * 1000)
    // Handle {seconds} format
    if (value?.seconds && typeof value.seconds === 'number') return new Date(value.seconds * 1000)
    // Handle Date object
    if (value instanceof Date) return value
    // Handle ISO string or other string formats
    if (typeof value === 'string') {
      const d = new Date(value)
      if (!Number.isNaN(d.getTime())) return d
    }
    // Try as number (timestamp in milliseconds)
    if (typeof value === 'number') {
      const d = new Date(value)
      if (!Number.isNaN(d.getTime())) return d
    }
    return null
  } catch (e) {
    console.error('Error parsing date in toDate:', e, value)
    return null
  }
}

const norm = (s) => String(s ?? '').trim().toLowerCase()

/**
 * Returns a reviewer-centric view of statuses.
 * We keep this tolerant because this repo mixes Title Case and snake_case.
 */
export const reviewerStatus = (rawStatus) => {
  const s = norm(rawStatus)

  // Needs review (reviewer action)
  if (s === 'pending review' || s === 'pending_review' || s === 'under_review' || s === 'under review') {
    return { label: 'Needs Review', bucket: 'needs_review' }
  }

  // Needs revision - regulation is being revised by employee, reviewer can track progress
  if (s === 'needs revision' || s === 'needs_revision') {
    return { label: 'In Revision', bucket: 'in_revision' }
  }

  // Rejected (reviewer edits feedback)
  if (s === 'rejected') {
    return { label: 'Rejected', bucket: 'rejected' }
  }

  // Approved by reviewer, waiting for admin
  if (
    s === 'pending publish' ||
    s === 'pending_publish' ||
    s === 'pending approval' ||
    s === 'pending_approval'
  ) {
    return { label: 'Pending Admin', bucket: 'pending_admin' }
  }

  // Completed from reviewer perspective (admin published)
  if (s === 'published' || s === 'archived') {
    return { label: 'Completed', bucket: 'completed' }
  }

  // Drafts are not reviewer items, but don’t break UI
  if (s === 'draft') return { label: 'Draft', bucket: 'other' }

  // Fallback: attempt fuzzy matching
  if (s.includes('revision')) return { label: 'In Revision', bucket: 'in_revision' }
  if (s.includes('reject')) return { label: 'Rejected', bucket: 'rejected' }
  if (s.includes('approval')) return { label: 'Pending Admin', bucket: 'pending_admin' }
  if (s.includes('pending') && s.includes('publish')) return { label: 'Pending Admin', bucket: 'pending_admin' }
  if (s.includes('published')) return { label: 'Completed', bucket: 'completed' }
  if (s.includes('review')) return { label: 'Needs Review', bucket: 'needs_review' }

  return { label: rawStatus || '-', bucket: 'other' }
}


export const fmtShortDate = (value) => {
  const d = toDate(value)
  if (!d) return '-'
  const dd = d.getDate()
  const mm = d.getMonth() + 1
  const yy = String(d.getFullYear()).slice(-2)
  return `${dd}/${mm}/${yy}`
}

/**
 * Live regulations list for reviewer pages.
 * We subscribe to the whole collection and filter client-side to avoid status-case mismatches.
 */
export default function useReviewerRegulations() {
  const { user } = useAuth()
  const [rawRegs, setRawRegs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user?.uid) return

    setLoading(true)
    const unsub = onSnapshot(
      collection(db, 'regulations'),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setRawRegs(rows)
        setLoading(false)
      },
      (err) => {
        console.error('useReviewerRegulations snapshot error:', err)
        setError(err)
        setLoading(false)
      }
    )

    return () => unsub()
  }, [user?.uid])

const regulations = useMemo(() => {
  // Reviewer cares about everything except Draft
  return rawRegs
    .map((r) => {
      const status = reviewerStatus(r.status);
      // Determine the reference number, preferring refNumber, then ref, then referenceNo, then a portion of the ID
      const ref = r.refNumber || r.ref || r.referenceNo || r.id?.substring(0, 8) || '-';
      
      // Get the appropriate deadline (revisionDeadline for "Needs Revision" or "Rejected", otherwise regular deadline)
      // Prioritize revisionDeadline if it exists and status is rejected or in_revision
      const rawDeadline = ((status.bucket === 'rejected' || status.bucket === 'in_revision') && r.revisionDeadline) 
        ? r.revisionDeadline 
        : r.deadline;
      
      const deadlineDate = toDate(rawDeadline);
      const deadlineLabel = deadlineDate ? fmtShortDate(rawDeadline) : '-';
      
      // Also store revisionDeadline separately for display purposes
      const revisionDeadlineDate = r.revisionDeadline ? toDate(r.revisionDeadline) : null;
      const revisionDeadlineLabel = revisionDeadlineDate ? fmtShortDate(r.revisionDeadline) : null;
      
      return {
        ...r,
        ref, // Set both ref and refNumber to ensure consistency
        refNumber: ref,
        displayStatus: status.label,
        statusBucket: status.bucket,
        deadlineDate: deadlineDate,
        deadlineLabel: deadlineLabel,
        revisionDeadlineDate: revisionDeadlineDate,
        revisionDeadlineLabel: revisionDeadlineLabel,
        updatedAtDate: toDate(r.updatedAt || r.lastUpdated || r.createdAt),
        feedbackLabel: (r.feedback && String(r.feedback).trim()) || 'No Feedback',
      };
    })
    .filter((r) => r.statusBucket !== 'other' || norm(r.status) !== 'draft')
    .sort((a, b) => {
      const ad = a.updatedAtDate || new Date(0);
      const bd = b.updatedAtDate || new Date(0);
      return bd - ad;
    });
}, [rawRegs]);

  return { regulations, loading, error }
}
