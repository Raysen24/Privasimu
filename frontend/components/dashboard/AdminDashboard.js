import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { format } from 'date-fns';
import { toast } from 'react-toastify';

// Chart
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from 'recharts';

const normalizeStatus = (status) =>
  String(status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (value?._seconds) return new Date(value._seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const fmtDateTime = (value, fallback = '-') => {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const fmtDateInput = (value) => {
  const d = toDate(value);
  if (!d) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const StatusPill = ({ status }) => {
  const key = normalizeStatus(status);
  const map = {
    draft: 'bg-gray-100 text-gray-800',
    pending_review: 'bg-blue-100 text-blue-800',
    under_review: 'bg-blue-100 text-blue-800',
    pending_approval: 'bg-blue-100 text-blue-800',
    pending_publish: 'bg-blue-100 text-blue-800',
    needs_revision: 'bg-red-100 text-red-800',
    rejected: 'bg-red-100 text-red-800',
    published: 'bg-green-100 text-green-800'
  };
  const label = String(status || '—').replace(/_/g, ' ');
  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded ${map[key] || 'bg-gray-100 text-gray-800'}`}
    >
      {label}
    </span>
  );
};

export default function AdminDashboard() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();

  const [regulations, setRegulations] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedRegulation, setSelectedRegulation] = useState(null);
  const [detailMode, setDetailMode] = useState(null); // 'view' | 'edit'

  // Assign reviewer modal
  const [showAssign, setShowAssign] = useState(false);
  const [selectedReviewer, setSelectedReviewer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Admin actions
  const [adminNotes, setAdminNotes] = useState('');
  const [revisionDeadline, setRevisionDeadline] = useState(''); // yyyy-mm-dd

  useEffect(() => {
    if (!isAdmin()) {
      router.push('/unauthorized');
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    fetchData();
  }, [isAdmin, router]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Regulations is required; reviewers is nice-to-have.
      const [regsRes, revsRes] = await Promise.allSettled([
        fetchRegulations(),
        fetchReviewers()
      ]);

      if (regsRes.status === 'rejected') throw regsRes.reason;

      if (revsRes.status === 'rejected') {
        console.warn('Reviewer list load failed (often Firestore rules for users list):', revsRes.reason);
        toast.warn('Reviewer list could not be loaded. (Check Firestore rules for admin user listing)');
      }
    } catch (e) {
      console.error('Admin dashboard load failed:', e);
      toast.error(`Failed to load admin data: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviewers = async () => {
    const snap = await getDocs(query(collection(db, 'users')));
    const data = [];
    snap.forEach((d) => {
      const role = String(d.data().role || '').toLowerCase();
      if (d.id !== user?.uid && ['reviewer', 'admin'].includes(role)) {
        data.push({ id: d.id, ...d.data() });
      }
    });
    setReviewers(data);
  };

  const fetchRegulations = async () => {
    const snap = await getDocs(query(collection(db, 'regulations')));
    const data = [];
    snap.forEach((d) => data.push({ id: d.id, ...d.data() }));
    setRegulations(data);
  };

  // Deep-link support (Actions Needed -> /dashboard/admin?id=...&mode=view|edit)
  useEffect(() => {
    if (!router.isReady) return;

    const id = router.query?.id;
    const mode = router.query?.mode;

    if (!id) {
      // If query cleared, close detail.
      setSelectedRegulation(null);
      setDetailMode(null);
      setShowAssign(false);
      return;
    }

    const nextMode = mode === 'edit' ? 'edit' : 'view';

    const inList = regulations.find((r) => r.id === id);
    if (inList) {
      setSelectedRegulation(inList);
      setDetailMode(nextMode);
      setAdminNotes(inList.adminNotes || '');
      setRevisionDeadline(inList.revisionDeadline ? fmtDateInput(inList.revisionDeadline) : '');
      setSelectedReviewer(inList.assignedReviewer || '');
      return;
    }

    // Fallback: fetch single doc
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'regulations', id));
        if (!snap.exists()) {
          toast.error('Regulation not found');
          router.push('/dashboard/admin', undefined, { shallow: true });
          return;
        }
        const r = { id: snap.id, ...snap.data() };
        setSelectedRegulation(r);
        setDetailMode(nextMode);
        setAdminNotes(r.adminNotes || '');
        setRevisionDeadline(r.revisionDeadline ? fmtDateInput(r.revisionDeadline) : '');
        setSelectedReviewer(r.assignedReviewer || '');
      } catch (e) {
        console.error(e);
        toast.error('Failed to load regulation');
      }
    })();
  }, [router.isReady, router.query?.id, router.query?.mode, regulations]);

  /* -----------------------------
     GRAPH DATA
  ----------------------------- */
  const chartData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: format(new Date(new Date().getFullYear(), i, 1), 'MMM'),
      drafts: 0,
      submitted: 0,
      published: 0,
      rejected: 0
    }));

    regulations.forEach((r) => {
      const d = toDate(r.updatedAt) || toDate(r.createdAt);
      if (!d) return;

      const monthIndex = d.getMonth();
      const s = normalizeStatus(r.status);

      if (s === 'draft') months[monthIndex].drafts += 1;

      if (['pending_review', 'under_review', 'pending_approval', 'pending_publish'].includes(s)) {
        months[monthIndex].submitted += 1;
      }

      if (s === 'published') months[monthIndex].published += 1;

      if (s === 'rejected' || s === 'needs_revision') months[monthIndex].rejected += 1;
    });

    return months;
  }, [regulations]);

  const goDetail = (r, mode) => {
    if (!r?.id) return;
    router.push(
      { pathname: '/dashboard/admin', query: { id: r.id, mode } },
      undefined,
      { shallow: true }
    );
  };

  const closeDetail = () => {
    router.push('/dashboard/admin', undefined, { shallow: true });
  };

  /* -----------------------------
     ACTIONS
  ----------------------------- */
  const handleAssignReviewer = async () => {
    if (!selectedRegulation?.id) return;
    if (!selectedReviewer) return toast.error('Select a reviewer');

    try {
      setIsSubmitting(true);
      const reviewerSnap = await getDoc(doc(db, 'users', selectedReviewer));
      const reviewerName = reviewerSnap.exists() ? reviewerSnap.data()?.name : '';

      await updateDoc(doc(db, 'regulations', selectedRegulation.id), {
        assignedReviewer: selectedReviewer,
        assignedReviewerName: reviewerName || 'Reviewer',
        status: 'Pending Review',
        updatedAt: serverTimestamp()
      });

      toast.success('Reviewer assigned');
      setShowAssign(false);
      await fetchRegulations();
    } catch (e) {
      console.error(e);
      toast.error('Failed to assign reviewer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedRegulation?.id) return;
    try {
      setIsSubmitting(true);
      await updateDoc(doc(db, 'regulations', selectedRegulation.id), {
        status: 'Published',
        adminNotes: adminNotes || '',
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.success('Regulation published');
      closeDetail();
      await fetchRegulations();
    } catch (e) {
      console.error(e);
      toast.error('Failed to publish regulation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNeedsRevision = async () => {
    if (!selectedRegulation?.id) return;
    if (!revisionDeadline) {
      toast.error('Please set a revision deadline');
      return;
    }

    try {
      setIsSubmitting(true);
      await updateDoc(doc(db, 'regulations', selectedRegulation.id), {
        status: 'Needs Revision',
        adminNotes: adminNotes || '',
        revisionDeadline: new Date(revisionDeadline),
        deniedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.info('Marked for revision');
      closeDetail();
      await fetchRegulations();
    } catch (e) {
      console.error(e);
      toast.error('Failed to update regulation');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* -----------------------------
     RENDER
  ----------------------------- */
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-12 w-12 border-t-2 border-blue-500 rounded-full" />
      </div>
    );
  }

  // DETAIL VIEW / EDIT
  if (selectedRegulation && detailMode) {
    const r = selectedRegulation;
    const statusKey = normalizeStatus(r.status);
    const isPendingPublish = statusKey === 'pending_publish';

    const timeline = [
      { label: 'Created', at: r.createdAt },
      { label: 'Submitted', at: r.submittedAt },
      { label: 'Reviewed', at: r.reviewedAt },
      { label: 'Rejected / Revision Requested', at: r.deniedAt },
      { label: 'Published', at: r.publishedAt }
    ].filter((t) => !!toDate(t.at));

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={closeDetail}
            className="px-4 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50"
          >
            ← Back
          </button>

          <div className="text-right">
            <div className="text-sm text-gray-600">Regulation</div>
            <div className="text-xl font-semibold text-gray-900">{r.title || 'Untitled'}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* MAIN */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <StatusPill status={r.status} />
              <div className="text-sm text-gray-600">
                <span className="font-medium">Category:</span> {r.category || '-'}
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-medium">Reference:</span> {r.ref || r.refNumber || '-'}
              </div>
            </div>

            {/* Deadlines */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-xs text-gray-500">Admin Deadline</div>
                <div className="text-sm font-semibold text-gray-900">{fmtDateTime(r.deadline, '-')}</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-xs text-gray-500">Revision Deadline</div>
                <div className="text-sm font-semibold text-gray-900">
                  {detailMode === 'edit' ? (
                    <input
                      type="date"
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                      value={revisionDeadline}
                      onChange={(e) => setRevisionDeadline(e.target.value)}
                    />
                  ) : (
                    fmtDateTime(r.revisionDeadline, '-')
                  )}
                </div>
              </div>
            </div>

            {/* Content */}
            {r.description ? (
              <div
                className="prose max-w-none text-gray-800"
                dangerouslySetInnerHTML={{ __html: r.description }}
              />
            ) : (
              <div className="text-gray-500 text-sm">No content.</div>
            )}

            {/* Attachments */}
            {Array.isArray(r.attachments) && r.attachments.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Attachments</h3>
                <div className="bg-white border border-gray-200 rounded-lg divide-y">
                  {r.attachments.map((a, idx) => (
                    <div
                      key={`${a.url || idx}`}
                      className="flex items-center justify-between px-4 py-3 text-sm text-gray-700"
                    >
                      <div>
                        <div className="font-medium">{a.name || `Attachment ${idx + 1}`}</div>
                        {a.url && (
                          <div className="text-xs text-gray-500 truncate max-w-sm">{a.url}</div>
                        )}
                      </div>
                      {a.url && (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm font-medium"
                        >
                          Open
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Timeline</h3>
              {timeline.length === 0 ? (
                <div className="text-sm text-gray-500">No timeline events yet.</div>
              ) : (
                <div className="space-y-2">
                  {timeline.map((t) => (
                    <div key={t.label} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{t.label}</span>
                      <span className="text-gray-500">{fmtDateTime(t.at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SIDE */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              {detailMode === 'edit' ? 'Admin Actions' : 'Quick Actions'}
            </h3>

            <div className="text-sm text-gray-600 space-y-2 mb-4">
              <div>
                <span className="font-medium">Created By:</span> {r.createdBy || '-'}
              </div>
              <div>
                <span className="font-medium">Assigned Reviewer:</span> {r.assignedReviewerName || r.assignedReviewer || '-'}
              </div>
            </div>

            {/* Notes */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes</label>
              <textarea
                className="w-full min-h-[120px] px-3 py-2 border border-gray-300 rounded-md"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add notes (optional)"
              />
            </div>

            {/* Buttons */}
            <div className="space-y-2">
              {detailMode === 'view' ? (
                <>
                  <button
                    className="w-full px-4 py-2 rounded-md bg-gray-900 text-white hover:bg-black"
                    onClick={() => goDetail(r, 'edit')}
                    disabled={!isPendingPublish}
                    title={isPendingPublish ? 'Edit regulation' : 'Only Pending Publish can be edited'}
                  >
                    Edit
                  </button>

                  <button
                    className="w-full px-4 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50"
                    onClick={() => setShowAssign(true)}
                  >
                    Assign / Reassign Reviewer
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="w-full px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                    onClick={handlePublish}
                    disabled={isSubmitting}
                  >
                    Publish
                  </button>

                  <button
                    className="w-full px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    onClick={handleNeedsRevision}
                    disabled={isSubmitting}
                  >
                    Reject / Needs Revision
                  </button>

                  <button
                    className="w-full px-4 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50"
                    onClick={() => goDetail(r, 'view')}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Assign reviewer modal */}
        {showAssign && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
            <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Assign Reviewer</h4>
              <p className="text-sm text-gray-600 mb-4">
                Select a reviewer to handle this regulation.
              </p>

              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={selectedReviewer}
                onChange={(e) => setSelectedReviewer(e.target.value)}
              >
                <option value="">-- Select reviewer --</option>
                {reviewers.map((rv) => (
                  <option key={rv.id} value={rv.id}>
                    {rv.name || rv.email || rv.id}
                  </option>
                ))}
              </select>

              <div className="flex gap-2 justify-end mt-6">
                <button
                  className="px-4 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50"
                  onClick={() => setShowAssign(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  onClick={handleAssignReviewer}
                  disabled={isSubmitting}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* -----------------------------
     OVERVIEW
  ----------------------------- */
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-500">Overview of regulations and actions</p>
      </div>

      <div className="bg-white p-6 rounded-lg border mb-8">
        <h2 className="text-lg font-semibold mb-4">Regulations Progress (Yearly)</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="drafts" strokeWidth={2} />
              <Line type="monotone" dataKey="submitted" strokeWidth={2} />
              <Line type="monotone" dataKey="published" strokeWidth={2} />
              <Line type="monotone" dataKey="rejected" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Regulations</h2>
          <button
            className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-sm"
            onClick={fetchData}
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-6 py-3">Title</th>
                <th className="text-left px-6 py-3">Category</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-left px-6 py-3">Updated</th>
                <th className="text-right px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {regulations.length === 0 ? (
                <tr>
                  <td className="px-6 py-6 text-gray-500" colSpan={5}>
                    No regulations found.
                  </td>
                </tr>
              ) : (
                regulations
                  .slice()
                  .sort((a, b) => (toDate(b.updatedAt)?.getTime() || 0) - (toDate(a.updatedAt)?.getTime() || 0))
                  .map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{r.title || 'Untitled'}</td>
                      <td className="px-6 py-4 text-gray-700">{r.category || '-'}</td>
                      <td className="px-6 py-4"><StatusPill status={r.status} /></td>
                      <td className="px-6 py-4 text-gray-600">{fmtDateTime(r.updatedAt, '-')}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => goDetail(r, 'view')}
                            className="px-3 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50"
                          >
                            View
                          </button>
                          <button
                            onClick={() => goDetail(r, 'edit')}
                            disabled={normalizeStatus(r.status) !== 'pending_publish'}
                            title={
                              normalizeStatus(r.status) === 'pending_publish'
                                ? 'Edit regulation'
                                : 'Only Pending Publish can be edited'
                            }
                            className="px-3 py-2 rounded-md bg-gray-900 text-white hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
