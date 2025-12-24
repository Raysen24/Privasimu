import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useSearch } from '../../contexts/SearchContext';
import { db } from '../../lib/firebase';
import {
  collection,
  query,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  getDoc
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
  return String(status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
};

const AdminDashboard = () => {
  const { user, isAdmin } = useAuth();
  const { searchTerm } = useSearch();
  const router = useRouter();

  const [regulations, setRegulations] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals / actions
  const [selectedAction, setSelectedAction] = useState(null);
  const [selectedRegulation, setSelectedRegulation] = useState(null);
  const [detailMode, setDetailMode] = useState(null); // 'view' | 'edit' | null
  const [selectedReviewer, setSelectedReviewer] = useState('');
  const [versionNotes, setVersionNotes] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [revisionDeadline, setRevisionDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAdmin()) {
      router.push('/unauthorized');
      return;
    }
    fetchData();
  }, [isAdmin, router]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchRegulations(), fetchReviewers()]);
    } catch (e) {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const fetchReviewers = async () => {
    const q = query(collection(db, 'users'));
    const snap = await getDocs(q);
    const data = [];
    snap.forEach((d) => {
      const role = String(d.data().role || "").toLowerCase();
      if (d.id !== user?.uid && ["reviewer", "admin"].includes(role)) {
        data.push({ id: d.id, ...d.data() });
      }
    });
    setReviewers(data);
  };

  const fetchRegulations = async () => {
    const q = query(collection(db, 'regulations'));
    const snap = await getDocs(q);
    const data = [];
    snap.forEach((d) => {
      const regulationData = { id: d.id, ...d.data() };
      const status = normalizeStatus(regulationData.status);
      // Filter out drafts - admins typically don't need to see drafts unless they're assigned
      // Drafts are usually only visible to the employee who created them
      if (status === 'draft') {
        return; // Skip drafts
      }
      // Debug: Log deadline data structure for first few regulations
      if (data.length < 3) {
        console.log('Regulation deadline data:', {
          id: d.id,
          status: regulationData.status,
          deadline: regulationData.deadline,
          deadlineType: typeof regulationData.deadline,
          deadlineKeys: regulationData.deadline ? Object.keys(regulationData.deadline) : null,
          revisionDeadline: regulationData.revisionDeadline
        });
      }
      data.push(regulationData);
    });
    setRegulations(data);
  };

  /* -----------------------------
     FILTERED REGULATIONS (based on search)
  ----------------------------- */
  const filteredRegulations = useMemo(() => {
    if (!searchTerm || !searchTerm.trim()) {
      return regulations;
    }
    
    const term = searchTerm.toLowerCase().trim();
    return regulations.filter((r) => {
      const title = (r.title || '').toLowerCase();
      const category = (r.category || '').toLowerCase();
      const status = (r.status || '').toLowerCase();
      const description = (r.description || '').toLowerCase();
      const content = (r.content || '').toLowerCase();
      const ref = (r.ref || r.refNumber || '').toLowerCase();
      
      return (
        title.includes(term) ||
        category.includes(term) ||
        status.includes(term) ||
        description.includes(term) ||
        content.includes(term) ||
        ref.includes(term)
      );
    });
  }, [regulations, searchTerm]);

  /* -----------------------------
     GRAPH DATA (Published vs Rejected per month)
  ----------------------------- */
  const chartData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: format(new Date(2025, i, 1), 'MMM'),
      published: 0,
      rejected: 0
    }));

    regulations.forEach((r) => {
      if (!r.updatedAt?.toDate) return;
      const monthIndex = r.updatedAt.toDate().getMonth();
      const s = normalizeStatus(r.status);

      if (s === 'published') months[monthIndex].published++;
      if (s === 'rejected' || s === 'needs_revision')
        months[monthIndex].rejected++;
    });

    return months;
  }, [regulations]);

  /* -----------------------------
     HELPERS
  ----------------------------- */
  const formatDate = (date) => {
    if (!date) return 'No deadline set';
    try {
      let dateObj;
      // Handle Firestore Timestamp
      if (date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      }
      // Handle Firestore timestamp with _seconds
      else if (date && date._seconds && typeof date._seconds === 'number') {
        dateObj = new Date(date._seconds * 1000);
      }
      // Handle Firestore timestamp with seconds
      else if (date && date.seconds && typeof date.seconds === 'number') {
        dateObj = new Date(date.seconds * 1000);
      }
      // Handle Date object
      else if (date instanceof Date) {
        dateObj = date;
      }
      // Handle string or number
      else {
        dateObj = new Date(date);
      }
      
      if (!dateObj || isNaN(dateObj.getTime())) {
        console.warn('Invalid date format:', date);
        return 'No deadline set';
      }
      
      return format(dateObj, 'MMM d, yyyy');
    } catch (e) {
      console.error('Error formatting date:', e, date);
      return 'No deadline set';
    }
  };

  const getStatusBadge = (status) => {
    const key = normalizeStatus(status);
    const map = {
      draft: 'bg-gray-100 text-gray-800',
      pending_review: 'bg-yellow-100 text-yellow-800',
      under_review: 'bg-blue-100 text-blue-800',
      pending_publish: 'bg-blue-100 text-blue-800',
      pending_approval: 'bg-blue-100 text-blue-800',
      needs_revision: 'bg-red-100 text-red-800',
      rejected: 'bg-red-100 text-red-800',
      published: 'bg-green-100 text-green-800'
    };

    const label = String(status || '—').replace(/_/g, ' ');

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${map[key] || 'bg-gray-100 text-gray-800'}`}>
        {label}
      </span>
    );
  };

  /* -----------------------------
     ACTION HANDLERS
  ----------------------------- */
  const openView = (r) => {
    setSelectedRegulation(r);
    setDetailMode('view');
    setAdminNotes(''); // show stored adminNotes from doc in UI
    setRevisionDeadline('');
  };

  const openEdit = (r) => {
    setSelectedRegulation(r);
    setDetailMode('edit');
    setAdminNotes(r.adminNotes || '');
    // Pre-fill existing revision deadline if present
    const rd = r.revisionDeadline;
    if (rd?.toDate) {
      const d = rd.toDate();
      setRevisionDeadline(d.toISOString().slice(0, 16));
    } else if (rd) {
      try {
        const d = new Date(rd);
        setRevisionDeadline(!isNaN(d.getTime()) ? d.toISOString().slice(0, 16) : '');
      } catch {
        setRevisionDeadline('');
      }
    } else {
      setRevisionDeadline('');
    }
  };

  const handleAssignReviewer = async () => {
    if (!selectedReviewer) return toast.error('Select a reviewer');

    try {
      setIsSubmitting(true);
      const ref = doc(db, 'regulations', selectedRegulation.id);
      const reviewer = await getDoc(doc(db, 'users', selectedReviewer));

      await updateDoc(ref, {
        assignedReviewer: selectedReviewer,
        assignedReviewerName: reviewer.data().name || 'Reviewer',
        status: 'Pending Review',
        updatedAt: new Date()
      });

      toast.success('Reviewer assigned');
      setSelectedAction(null);
      fetchRegulations();
    } catch {
      toast.error('Failed to assign reviewer');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Publish from editor (simple admin flow)
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
        updatedAt: now
      });
      toast.success('Regulation published');
      setSelectedRegulation(null);
      setDetailMode(null);
      setAdminNotes('');
      fetchRegulations();
    } catch (e) {
      console.error(e);
      toast.error('Failed to publish regulation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDenyAction = async () => {
    if (!selectedRegulation) return;

    if (!revisionDeadline) {
      return toast.error('Please set a revision deadline before denying.');
    }

    try {
      setIsSubmitting(true);
      const ref = doc(db, 'regulations', selectedRegulation.id);
      const now = new Date();
      const deadlineDate = new Date(revisionDeadline);
      const safeDeadline = !isNaN(deadlineDate.getTime()) ? deadlineDate : null;
      
      await updateDoc(ref, {
        status: 'Needs Revision',
        adminNotes: adminNotes,
        revisionDeadline: safeDeadline,
        deniedAt: now,
        updatedAt: now
      });
      
      toast.info('Regulation marked for revision');
      setSelectedRegulation(null);
      setDetailMode(null);
      setAdminNotes('');
      fetchRegulations();
    } catch (e) {
      console.error(e);
      toast.error('Failed to update regulation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Existing publish used elsewhere (versioned publish) left intact

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-12 w-12 border-t-2 border-blue-500 rounded-full" />
      </div>
    );
  }

  // DETAIL VIEW inside dashboard
  if (selectedRegulation && detailMode) {
    return (
      <div className="container mx-auto px-4 py-8">
        <button
          onClick={() => {
            setSelectedRegulation(null);
            setDetailMode(null);
          }}
          className="mb-6 px-4 py-2 text-blue-600 hover:text-blue-800 font-medium"
        >
          ← Back to Dashboard
        </button>

        <div className="grid grid-cols-3 gap-6">
          {/* Left: Regulation Details */}
          <div className="col-span-2 bg-white rounded-lg border p-6">
            <h2 className="text-2xl font-bold mb-4">
              {selectedRegulation.title}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Category
                </label>
                <p className="text-gray-900">
                  {selectedRegulation.category || 'N/A'}
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Status
                </label>
                <div className="mt-1">
                  {getStatusBadge(selectedRegulation.status)}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Deadline Assigned
                </label>
                <p className="text-gray-900">
                  {(() => {
                    const status = String(selectedRegulation.status || '').toLowerCase().trim();
                    if (status === 'published' || status === 'publish') {
                      return '—';
                    }
                    // Check for revision deadline first if status is "Needs Revision"
                    const deadline = (status === 'needs revision' || status === 'needs_revision') && selectedRegulation.revisionDeadline
                      ? selectedRegulation.revisionDeadline
                      : selectedRegulation.deadline;
                    const formatted = formatDate(deadline);
                    return formatted;
                  })()}
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Description
                </label>
                {selectedRegulation.description ? (
                  <div 
                    className="text-gray-900 mt-1"
                    style={{ wordWrap: 'break-word' }}
                    dangerouslySetInnerHTML={{ __html: selectedRegulation.description }}
                  />
                ) : (
                  <p className="text-gray-500">N/A</p>
                )}
              </div>

              {/* Reviewer Feedback */}
              {(selectedRegulation.feedback || selectedRegulation.reviewerFeedback) && (
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Reviewer Feedback
                  </label>
                  <div className="mt-1 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-gray-900 whitespace-pre-wrap">
                      {selectedRegulation.feedback || selectedRegulation.reviewerFeedback || 'N/A'}
                    </p>
                    {selectedRegulation.reviewedBy && (
                      <p className="text-xs text-gray-500 mt-2">
                        Reviewed by: {selectedRegulation.reviewerName || selectedRegulation.reviewedBy}
                        {selectedRegulation.reviewedAt && (
                          <span className="ml-2">
                            on {formatDate(selectedRegulation.reviewedAt)}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Attachments */}
              {Array.isArray(selectedRegulation.attachments) && selectedRegulation.attachments.length > 0 && (
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Attachments
                  </label>
                  <div className="mt-1 bg-white border border-gray-200 rounded-lg divide-y">
                    {selectedRegulation.attachments.map((attachment, index) => (
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

              {/* Timeline */}
              <div className="border-t pt-4 mt-4">
                <label className="text-sm font-semibold text-gray-700 mb-3 block">
                  Timeline
                </label>
                <div className="space-y-2 text-sm text-gray-600">
                  {(selectedRegulation.createdAt || selectedRegulation.submittedAt) && (
                    <p className="flex items-center">
                      <svg className="h-4 w-4 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="font-medium">
                        {selectedRegulation.submittedAt ? 'Submitted' : 'Created'}: 
                      </span>
                      <span className="ml-1">
                        {formatDate(selectedRegulation.submittedAt || selectedRegulation.createdAt)}
                      </span>
                    </p>
                  )}
                  {selectedRegulation.reviewedAt && (
                    <p className="flex items-center">
                      <svg className="h-4 w-4 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">Reviewed: </span>
                      <span className="ml-1">
                        {formatDate(selectedRegulation.reviewedAt)}
                      </span>
                    </p>
                  )}
                  {selectedRegulation.publishedAt && (
                    <p className="flex items-center">
                      <svg className="h-4 w-4 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span className="font-medium">Published: </span>
                      <span className="ml-1">
                        {formatDate(selectedRegulation.publishedAt)}
                      </span>
                    </p>
                  )}
                  {selectedRegulation.updatedAt && (
                    <p className="flex items-center">
                      <svg className="h-4 w-4 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="font-medium">Last Updated: </span>
                      <span className="ml-1">
                        {formatDate(selectedRegulation.updatedAt)}
                      </span>
                    </p>
                  )}
                  
                  {/* History Timeline */}
                  {Array.isArray(selectedRegulation.history) && selectedRegulation.history.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-500 mb-2">Activity History</p>
                      <div className="space-y-2">
                        {selectedRegulation.history
                          .slice()
                          .sort((a, b) => {
                            const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime();
                            const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime();
                            return bTime - aTime; // Most recent first
                          })
                          .map((entry, idx) => {
                            const timestamp = entry.timestamp?.toDate ? entry.timestamp.toDate() : new Date(entry.timestamp);
                            const actionLabels = {
                              'created': 'Created',
                              'submitted_for_review': 'Submitted for Review',
                              'approved_by_reviewer': 'Approved by Reviewer',
                              'rejected_by_reviewer': 'Rejected by Reviewer',
                              'revision_requested': 'Revision Requested',
                              'deadline_assigned': 'Deadline Assigned',
                              'published': 'Published'
                            };
                            return (
                              <div key={idx} className="flex items-start text-xs">
                                <svg className="h-3 w-3 text-gray-400 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="flex-1">
                                  <span className="font-medium text-gray-700">
                                    {actionLabels[entry.action] || entry.action}
                                  </span>
                                  {entry.comment && (
                                    <span className="text-gray-500 ml-1">- {entry.comment}</span>
                                  )}
                                  <div className="text-gray-400 mt-0.5">
                                    {formatDate(timestamp)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Notes & Actions */}
          <div className="col-span-1 bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold mb-4">Admin Notes</h3>

            {detailMode === 'view' ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 min-h-40">
                <p className="text-gray-900 whitespace-pre-wrap">
                  {selectedRegulation.adminNotes || 'No notes added'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1 block">
                    Revision Deadline
                  </label>
                  <input
                    type="datetime-local"
                    value={revisionDeadline}
                    onChange={(e) => setRevisionDeadline(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min={new Date().toISOString().slice(0, 16)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Required when denying; visible to the employee.
                  </p>
                </div>

                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add your notes here..."
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
                
                <div className="space-y-3">
                  <button
                    onClick={handlePublishAction}
                    disabled={isSubmitting}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                  >
                    {isSubmitting ? 'Publishing...' : 'Publish'}
                  </button>
                  
                  <button
                    onClick={handleDenyAction}
                    disabled={isSubmitting}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
                  >
                    {isSubmitting ? 'Denying...' : 'Deny'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default dashboard (graph + table)
  return (
    <div className="container mx-auto px-4 py-8">
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-500">
          Overview of published and rejected regulations
        </p>
      </div>

      {/* GRAPH */}
      <div className="bg-white p-6 rounded-lg border mb-8">
        <h2 className="text-lg font-semibold mb-4">
          Regulations Progress (Yearly)
        </h2>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="published"
                stroke="#22c55e"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="rejected"
                stroke="#ef4444"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* REGULATIONS TABLE */}
      <div className="bg-white rounded-lg border">
        <div className="p-6">
          <h2 className="text-lg font-semibold">Regulations</h2>
          <p className="text-sm text-gray-500">
            Manage and review all regulations
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">
                  Deadline Assigned
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {filteredRegulations.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">{r.title}</td>
                  <td className="px-6 py-4">{getStatusBadge(r.status)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {(() => {
                      const status = String(r.status || '').toLowerCase().trim();
                      if (status === 'published' || status === 'publish') {
                        return '—';
                      }
                      // Check for revision deadline first if status is "Needs Revision"
                      const deadline = (status === 'needs revision' || status === 'needs_revision') && r.revisionDeadline
                        ? r.revisionDeadline
                        : r.deadline;
                    const formatted = formatDate(deadline);
                    return formatted;
                    })()}
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <button
                      onClick={() => openView(r)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View
                    </button>

                    <button
                      onClick={() => openEdit(r)}
                      className="text-orange-600 hover:underline text-sm"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRegulations.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                    {searchTerm ? 'No regulations found matching your search.' : 'No regulations found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALS (Assign / Publish) — unchanged logic */}
      {/* keep your existing modals below if needed */}
    </div>
  );
};

export default AdminDashboard;