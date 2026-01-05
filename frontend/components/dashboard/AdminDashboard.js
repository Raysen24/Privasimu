import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  updateDoc
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

const normalizeStatus = (status) => {
  return String(status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
};

const safeToDate = (value) => {
  try {
    if (!value) return null;
    if (value?.toDate) return value.toDate(); // Firestore Timestamp
    if (value instanceof Date) return value;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const toDatetimeLocalValue = (value) => {
  const d = safeToDate(value);
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

const formatDate = (value) => {
  const d = safeToDate(value);
  return d ? format(d, 'dd MMM yyyy') : 'N/A';
};

const formatDateTime = (value) => {
  const d = safeToDate(value);
  return d ? format(d, 'dd MMM yyyy, HH:mm') : 'N/A';
};

const getStatusBadge = (status) => {
  const s = normalizeStatus(status);

  let label = status || 'Unknown';
  let cls = 'bg-gray-100 text-gray-800 border border-gray-200';

  if (['draft'].includes(s)) {
    label = 'Draft';
    cls = 'bg-gray-100 text-gray-800 border border-gray-200';
  } else if (['pending_review', 'under_review', 'pending_approval'].includes(s)) {
    label = 'In Review';
    cls = 'bg-blue-100 text-blue-800 border border-blue-200';
  } else if (['needs_revision', 'rejected'].includes(s)) {
    label = 'Needs Revision';
    cls = 'bg-red-100 text-red-800 border border-red-200';
  } else if (['pending_publish'].includes(s)) {
    label = 'Pending Publish';
    cls = 'bg-yellow-100 text-yellow-800 border border-yellow-200';
  } else if (['published'].includes(s)) {
    label = 'Published';
    cls = 'bg-green-100 text-green-800 border border-green-200';
  }

  return (
    <span className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full ${cls}`}>
      {label}
    </span>
  );
};

const AdminDashboard = () => {
  const { user, isAdmin } = useAuth();
  const router = useRouter();

  const [regulations, setRegulations] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Detail view / edit
  const [selectedRegulation, setSelectedRegulation] = useState(null);
  const [detailMode, setDetailMode] = useState(null); // 'view' | 'edit'
  const [adminNotes, setAdminNotes] = useState('');
  const [revisionDeadline, setRevisionDeadline] = useState('');
  const [selectedReviewer, setSelectedReviewer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAdmin()) {
      router.push('/unauthorized');
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [regsRes, reviewersRes] = await Promise.allSettled([
        fetchRegulations(),
        fetchReviewers()
      ]);

      if (reviewersRes.status === 'rejected') {
        // Don't block dashboard if reviewer list is blocked by Firestore rules.
        console.warn('Fetch reviewers failed:', reviewersRes.reason);
        setReviewers([]);
      }

      if (regsRes.status === 'rejected') {
        throw regsRes.reason;
      }
    } catch (e) {
      console.error('Admin dashboard load failed:', e);
      toast.error(`Failed to load admin data: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviewers = async () => {
    const q = query(collection(db, 'users'));
    const snap = await getDocs(q);
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
    const q = query(collection(db, 'regulations'));
    const snap = await getDocs(q);
    const data = [];
    snap.forEach((d) => data.push({ id: d.id, ...d.data() }));
    setRegulations(data);
  };

  const chartData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: format(new Date(2025, i, 1), 'MMM'),
      drafts: 0,
      submitted: 0,
      published: 0,
      rejected: 0
    }));

    regulations.forEach((r) => {
      const d = safeToDate(r.updatedAt) || safeToDate(r.createdAt) || null;
      if (!d) return;

      const monthIndex = d.getMonth();
      const s = normalizeStatus(r.status);

      if (s === 'draft') months[monthIndex].drafts++;
      if (['pending_review', 'under_review', 'pending_approval', 'pending_publish'].includes(s)) {
        months[monthIndex].submitted++;
      }
      if (s === 'published') months[monthIndex].published++;
      if (s === 'needs_revision' || s === 'rejected') months[monthIndex].rejected++;
    });

    return months;
  }, [regulations]);

  const openView = (r) => {
    setSelectedRegulation(r);
    setDetailMode('view');
    setAdminNotes('');
    setSelectedReviewer('');
    setRevisionDeadline(toDatetimeLocalValue(r?.revisionDeadline || ''));
  };

  const openEdit = (r) => {
    setSelectedRegulation(r);
    setDetailMode('edit');
    setAdminNotes(r.adminNotes || '');
    setSelectedReviewer(r.assignedReviewer || '');
    setRevisionDeadline(toDatetimeLocalValue(r?.revisionDeadline || ''));
  };

  const closeDetail = () => {
    setSelectedRegulation(null);
    setDetailMode(null);
    setAdminNotes('');
    setSelectedReviewer('');
    setRevisionDeadline('');
    if (router?.query?.id || router?.query?.mode) {
      router.replace('/dashboard/admin', undefined, { shallow: true });
    }
  };

  useEffect(() => {
    const { id, mode } = router.query || {};
    if (!id || !mode) return;

    const open = async () => {
      const m = String(mode).toLowerCase() === 'edit' ? 'edit' : 'view';
      const existing = regulations.find((x) => x.id === id);
      if (existing) {
        m === 'edit' ? openEdit(existing) : openView(existing);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'regulations', id));
        if (!snap.exists()) {
          toast.error('Regulation not found');
          return;
        }
        const r = { id: snap.id, ...snap.data() };
        m === 'edit' ? openEdit(r) : openView(r);
      } catch (e) {
        console.error('Failed to open regulation by id:', e);
        toast.error(`Failed to open regulation: ${e?.message || e}`);
      }
    };

    open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query?.id, router.query?.mode, regulations]);

  const handleAssignReviewer = async () => {
    if (!selectedRegulation) return;
    if (!selectedReviewer) return toast.error('Select a reviewer');

    try {
      setIsSubmitting(true);

      const ref = doc(db, 'regulations', selectedRegulation.id);
      const reviewerSnap = await getDoc(doc(db, 'users', selectedReviewer));

      await updateDoc(ref, {
        assignedReviewer: selectedReviewer,
        assignedReviewerName: reviewerSnap.data()?.name || 'Reviewer',
        status: 'Pending Review',
        updatedAt: new Date(),
        history: arrayUnion({
          action: 'admin_assigned_reviewer',
          actorId: user?.uid || null,
          actorRole: 'admin',
          timestamp: Timestamp.now(),
          note: `Assigned reviewer ID: ${selectedReviewer}`
        })
      });

      toast.success('Reviewer assigned');
      await fetchRegulations();
    } catch (e) {
      console.error(e);
      toast.error(`Failed to assign reviewer: ${e?.message || e}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishAction = async () => {
    if (!selectedRegulation) return;

    try {
      setIsSubmitting(true);
      const ref = doc(db, 'regulations', selectedRegulation.id);
      const now = new Date();

      await updateDoc(ref, {
        status: 'Published',
        adminNotes: adminNotes,
        publishedAt: now,
        publishedBy: user?.uid || null,
        publishedByName: user?.name || user?.email || 'Admin',
        updatedAt: now,
        history: arrayUnion({
          action: 'admin_published',
          actorId: user?.uid || null,
          actorRole: 'admin',
          timestamp: Timestamp.now(),
          note: adminNotes || 'Published'
        })
      });

      toast.success('Regulation published');
      closeDetail();
      await fetchRegulations();
    } catch (e) {
      console.error(e);
      toast.error(`Failed to publish: ${e?.message || e}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDenyAction = async () => {
    if (!selectedRegulation) return;

    if (!revisionDeadline) {
      toast.error('Please set a revision deadline first.');
      return;
    }

    try {
      setIsSubmitting(true);
      const ref = doc(db, 'regulations', selectedRegulation.id);
      const now = new Date();
      const deadlineDate = new Date(revisionDeadline);

      await updateDoc(ref, {
        status: 'Needs Revision',
        adminNotes: adminNotes,
        revisionDeadline: deadlineDate,
        deniedAt: now,
        deniedBy: user?.uid || null,
        deniedByName: user?.name || user?.email || 'Admin',
        updatedAt: now,
        history: arrayUnion({
          action: 'admin_requested_revision',
          actorId: user?.uid || null,
          actorRole: 'admin',
          timestamp: Timestamp.now(),
          note: adminNotes || ''
        })
      });

      toast.info('Regulation marked for revision');
      closeDetail();
      await fetchRegulations();
    } catch (e) {
      console.error(e);
      toast.error(`Failed to update regulation: ${e?.message || e}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canPublishOrDeny = useMemo(() => {
    const s = normalizeStatus(selectedRegulation?.status);
    return s === 'pending_publish';
  }, [selectedRegulation?.status]);

  const historyItems = useMemo(() => {
    const items = Array.isArray(selectedRegulation?.history)
      ? selectedRegulation.history.slice()
      : [];
    items.sort((a, b) => {
      const da = safeToDate(a?.timestamp) || new Date(0);
      const dbb = safeToDate(b?.timestamp) || new Date(0);
      return da.getTime() - dbb.getTime();
    });
    return items;
  }, [selectedRegulation?.history]);

  if (loading) {
    return (
      <div className=\"flex justify-center items-center h-64\">\n        <div className=\"animate-spin h-12 w-12 border-t-2 border-blue-500 rounded-full\" />\n      </div>
    );
  }

  if (selectedRegulation && detailMode) {
    const statusKey = normalizeStatus(selectedRegulation.status);
    const createdById =
      selectedRegulation.createdBy ||
      selectedRegulation.createdById ||
      selectedRegulation.employeeId ||
      null;

    return (
      <div className=\"container mx-auto px-4 py-8\">
        <div className=\"flex items-start justify-between mb-6\">
          <div>
            <button
              onClick={closeDetail}
              className=\"text-sm text-gray-600 hover:text-gray-900 hover:underline mb-2\"
            >
              ← Back to Dashboard
            </button>
            <h1 className=\"text-2xl font-bold\">{selectedRegulation.title || 'Regulation'}</h1>
            <div className=\"mt-2 flex items-center gap-2\">
              {getStatusBadge(selectedRegulation.status)}
              {createdById && (
                <span className=\"text-xs text-gray-500\">
                  Created by: <span className=\"font-medium\">{createdById}</span>
                </span>
              )}
            </div>
          </div>

          <div className=\"flex items-center gap-3\">
            <button
              onClick={closeDetail}
              className=\"px-4 py-2 border rounded text-sm hover:bg-gray-50\"
            >
              Close
            </button>
          </div>
        </div>

        <div className=\"grid grid-cols-1 lg:grid-cols-3 gap-6\">
          <div className=\"lg:col-span-2 space-y-6\">
            <div className=\"bg-white border rounded-lg p-6\">
              <h2 className=\"text-lg font-semibold mb-4\">Regulation Details</h2>

              <div className=\"grid grid-cols-1 md:grid-cols-2 gap-4 text-sm\">
                <div>
                  <p className=\"text-gray-500\">Category</p>
                  <p className=\"font-medium\">{selectedRegulation.category || 'N/A'}</p>
                </div>

                <div>
                  <p className=\"text-gray-500\">Deadline</p>
                  <p className=\"font-medium\">{formatDate(selectedRegulation.deadline)}</p>
                </div>

                <div>
                  <p className=\"text-gray-500\">Revision Deadline</p>
                  <p className=\"font-medium\">
                    {selectedRegulation.revisionDeadline
                      ? formatDateTime(selectedRegulation.revisionDeadline)
                      : '—'}
                  </p>
                </div>

                <div>
                  <p className=\"text-gray-500\">Assigned Reviewer</p>
                  <p className=\"font-medium\">
                    {selectedRegulation.assignedReviewerName ||
                      selectedRegulation.assignedReviewer ||
                      '—'}
                  </p>
                </div>
              </div>

              <div className=\"mt-6\">
                <p className=\"text-gray-500 text-sm mb-1\">Description</p>
                {selectedRegulation.description ? (
                  <div
                    className=\"text-gray-900\"
                    style={{ wordWrap: 'break-word' }}
                    dangerouslySetInnerHTML={{ __html: selectedRegulation.description }}
                  />
                ) : (
                  <p className=\"text-gray-500\">N/A</p>
                )}
              </div>

              {(selectedRegulation.feedback || selectedRegulation.reviewerFeedback) && (
                <div className=\"mt-6\">
                  <p className=\"text-gray-700 text-sm font-semibold mb-1\">Reviewer Feedback</p>
                  <div className=\"bg-blue-50 border border-blue-200 rounded-lg p-4\">
                    <p className=\"text-gray-900 whitespace-pre-wrap\">
                      {selectedRegulation.feedback || selectedRegulation.reviewerFeedback || 'N/A'}
                    </p>
                    {(selectedRegulation.reviewedBy || selectedRegulation.reviewedById) && (
                      <p className=\"text-xs text-gray-500 mt-2\">
                        Reviewed by:{' '}
                        <span className=\"font-medium\">
                          {selectedRegulation.reviewerName ||
                            selectedRegulation.reviewedBy ||
                            selectedRegulation.reviewedById}
                        </span>
                        {selectedRegulation.reviewedAt && (
                          <span className=\"ml-2\">on {formatDateTime(selectedRegulation.reviewedAt)}</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {Array.isArray(selectedRegulation.attachments) &&
                selectedRegulation.attachments.length > 0 && (
                  <div className=\"mt-6\">
                    <p className=\"text-gray-700 text-sm font-semibold mb-2\">Attachments</p>
                    <div className=\"bg-white border border-gray-200 rounded-lg divide-y\">
                      {selectedRegulation.attachments.map((attachment, index) => (
                        <div
                          key={`${attachment?.url || 'att'}-${index}`}
                          className=\"flex items-center justify-between px-4 py-3 text-sm text-gray-700\"
                        >
                          <div className=\"min-w-0 pr-3\">
                            <p className=\"font-medium\">
                              {attachment?.name || `Attachment ${index + 1}`}
                            </p>
                            <p className=\"text-xs text-gray-500 truncate\">
                              {attachment?.url || ''}
                            </p>
                          </div>
                          {attachment?.url ? (
                            <a
                              href={attachment.url}
                              target=\"_blank\"
                              rel=\"noopener noreferrer\"
                              className=\"text-blue-600 hover:underline text-sm font-medium\"
                            >
                              Open
                            </a>
                          ) : (
                            <span className=\"text-gray-400 text-sm\">—</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            <div className=\"bg-white border rounded-lg p-6\">
              <h2 className=\"text-lg font-semibold mb-4\">Timeline</h2>

              <div className=\"space-y-2 text-sm text-gray-700\">
                {(selectedRegulation.createdAt || selectedRegulation.submittedAt) && (
                  <p>
                    <span className=\"font-medium\">
                      {selectedRegulation.submittedAt ? 'Submitted' : 'Created'}:
                    </span>{' '}
                    {formatDateTime(selectedRegulation.submittedAt || selectedRegulation.createdAt)}
                  </p>
                )}
                {selectedRegulation.reviewedAt && (
                  <p>
                    <span className=\"font-medium\">Reviewed:</span>{' '}
                    {formatDateTime(selectedRegulation.reviewedAt)}
                  </p>
                )}
                {selectedRegulation.deniedAt && (
                  <p>
                    <span className=\"font-medium\">Revision Requested:</span>{' '}
                    {formatDateTime(selectedRegulation.deniedAt)}
                  </p>
                )}
                {selectedRegulation.publishedAt && (
                  <p>
                    <span className=\"font-medium\">Published:</span>{' '}
                    {formatDateTime(selectedRegulation.publishedAt)}
                  </p>
                )}
              </div>

              <div className=\"border-t mt-4 pt-4\">
                <h3 className=\"text-sm font-semibold text-gray-700 mb-3\">Progress Tracker</h3>

                {historyItems.length === 0 ? (
                  <p className=\"text-sm text-gray-500\">No history recorded yet.</p>
                ) : (
                  <ol className=\"space-y-3\">
                    {historyItems.map((h, idx) => (
                      <li key={`${h?.action || 'h'}-${idx}`} className=\"text-sm\">
                        <div className=\"flex flex-wrap items-center gap-x-2 gap-y-1\">
                          <span className=\"font-semibold text-gray-800\">{h?.action || 'action'}</span>
                          <span className=\"text-gray-500\">•</span>
                          <span className=\"text-gray-600\">{formatDateTime(h?.timestamp)}</span>
                          {h?.actorRole && (
                            <>
                              <span className=\"text-gray-500\">•</span>
                              <span className=\"text-gray-600\">{h.actorRole}</span>
                            </>
                          )}
                          {h?.actorId && (
                            <>
                              <span className=\"text-gray-500\">•</span>
                              <span className=\"text-gray-600\">
                                id: <span className=\"font-medium\">{h.actorId}</span>
                              </span>
                            </>
                          )}
                        </div>
                        {h?.note ? (
                          <p className=\"text-gray-600 mt-1 whitespace-pre-wrap\">{h.note}</p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>

          <div className=\"space-y-6\">
            <div className=\"bg-white border rounded-lg p-6\">
              <h2 className=\"text-lg font-semibold mb-4\">Admin Actions</h2>

              {(statusKey === 'draft' || statusKey === 'pending_approval') && (
                <div className=\"mb-5\">
                  <label className=\"text-sm font-semibold text-gray-700\">Assign Reviewer</label>
                  <div className=\"mt-2 flex gap-2\">
                    <select
                      value={selectedReviewer}
                      onChange={(e) => setSelectedReviewer(e.target.value)}
                      className=\"w-full border rounded px-3 py-2 text-sm\"
                    >
                      <option value=\"\">Select reviewer</option>
                      {reviewers.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name || r.email || r.id}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAssignReviewer}
                      disabled={isSubmitting}
                      className=\"px-3 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50\"
                    >
                      Assign
                    </button>
                  </div>
                </div>
              )}

              <div className=\"mb-5\">
                <label className=\"text-sm font-semibold text-gray-700\">Admin Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={4}
                  className=\"mt-2 w-full border rounded px-3 py-2 text-sm\"
                  placeholder=\"Add notes (optional)\"
                />
              </div>

              <div className=\"mb-5\">
                <label className=\"text-sm font-semibold text-gray-700\">Revision Deadline</label>
                <input
                  type=\"datetime-local\"
                  value={revisionDeadline}
                  onChange={(e) => setRevisionDeadline(e.target.value)}
                  className=\"mt-2 w-full border rounded px-3 py-2 text-sm\"
                />
                <p className=\"text-xs text-gray-500 mt-1\">Required if you deny / request revision.</p>
              </div>

              {canPublishOrDeny ? (
                <div className=\"flex flex-col gap-3\">
                  <button
                    onClick={handlePublishAction}
                    disabled={isSubmitting}
                    className=\"w-full py-2 rounded bg-green-600 text-white font-medium disabled:opacity-50\"
                  >
                    Publish
                  </button>
                  <button
                    onClick={handleDenyAction}
                    disabled={isSubmitting}
                    className=\"w-full py-2 rounded bg-red-600 text-white font-medium disabled:opacity-50\"
                  >
                    Deny / Request Revision
                  </button>
                </div>
              ) : (
                <div className=\"text-sm text-gray-600\">
                  <p>
                    Publish/Deny actions are available when status is{' '}
                    <span className=\"font-medium\">Pending Publish</span>.
                  </p>
                </div>
              )}
            </div>

            <div className=\"bg-white border rounded-lg p-6\">
              <h2 className=\"text-lg font-semibold mb-2\">Quick Info</h2>
              <p className=\"text-sm text-gray-600\">
                Status: <span className=\"font-medium\">{selectedRegulation.status || '—'}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className=\"container mx-auto px-4 py-8\">
      <div className=\"mb-8\">
        <h1 className=\"text-2xl font-bold\">Admin Dashboard</h1>
        <p className=\"text-gray-500\">Overview of published and rejected regulations</p>
      </div>

      <div className=\"bg-white p-6 rounded-lg border mb-8\">
        <h2 className=\"text-lg font-semibold mb-4\">Regulations Progress (Yearly)</h2>

        <div className=\"h-72\">
          <ResponsiveContainer width=\"100%\" height=\"100%\">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray=\"3 3\" />
              <XAxis dataKey=\"month\" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type=\"monotone\" dataKey=\"drafts\" stroke=\"#6b7280\" strokeWidth={2} />
              <Line type=\"monotone\" dataKey=\"submitted\" stroke=\"#3b82f6\" strokeWidth={2} />
              <Line type=\"monotone\" dataKey=\"published\" stroke=\"#22c55e\" strokeWidth={2} />
              <Line type=\"monotone\" dataKey=\"rejected\" stroke=\"#ef4444\" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className=\"bg-white rounded-lg border\">
        <div className=\"p-6\">
          <h2 className=\"text-lg font-semibold\">Regulations</h2>
          <p className=\"text-sm text-gray-500\">Manage and review all regulations</p>
        </div>

        <div className=\"overflow-x-auto\">
          <table className=\"min-w-full divide-y divide-gray-200\">
            <thead className=\"bg-gray-50\">
              <tr>
                <th className=\"px-6 py-3 text-left text-xs font-medium text-gray-500\">Title</th>
                <th className=\"px-6 py-3 text-left text-xs font-medium text-gray-500\">Status</th>
                <th className=\"px-6 py-3 text-left text-xs font-medium text-gray-500\">Deadline</th>
                <th className=\"px-6 py-3 text-right text-xs font-medium text-gray-500\">Actions</th>
              </tr>
            </thead>

            <tbody className=\"divide-y\">
              {regulations.map((r) => (
                <tr key={r.id} className=\"hover:bg-gray-50\">
                  <td className=\"px-6 py-4\">{r.title}</td>
                  <td className=\"px-6 py-4\">{getStatusBadge(r.status)}</td>
                  <td className=\"px-6 py-4 text-sm text-gray-500\">{formatDate(r.deadline)}</td>
                  <td className=\"px-6 py-4 text-right space-x-3\">
                    <button
                      onClick={() => openView(r)}
                      className=\"text-blue-600 hover:underline text-sm\"
                    >
                      View
                    </button>
                    <button
                      onClick={() => openEdit(r)}
                      className=\"text-orange-600 hover:underline text-sm\"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {regulations.length === 0 && (
                <tr>
                  <td colSpan={4} className=\"px-6 py-8 text-center text-gray-500\">
                    No regulations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
