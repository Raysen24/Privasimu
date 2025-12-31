import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useSearch } from '../../contexts/SearchContext';
import { db } from '../../lib/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { toast } from 'react-toastify';

const normalizeStatus = (status) => {
  return String(status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
};

const ITEMS_PER_PAGE = 8;

const ActionsNeeded = () => {
  const { user, isLoading, isAdmin } = useAuth();
  const { searchTerm } = useSearch();
  const router = useRouter();

  const [regulations, setRegulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!isAdmin || !isAdmin()) {
      router.push('/unauthorized');
      return;
    }
    fetchRegulations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user, isAdmin, router]);

  const fetchRegulations = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'regulations'));
      const snap = await getDocs(q);
      const data = [];
      snap.forEach((d) => {
        const regulationData = { id: d.id, ...d.data() };
        const status = normalizeStatus(regulationData.status);

        // Admins generally don't need Drafts (owned by employee)
        if (status === 'draft') return;

        data.push(regulationData);
      });
      setRegulations(data);
    } catch (e) {
      toast.error('Failed to load regulations');
    } finally {
      setLoading(false);
    }
  };

  /* -----------------------------
     FILTERED REGULATIONS (based on search)
  ----------------------------- */
  const filteredRegulations = useMemo(() => {
    if (!searchTerm || !searchTerm.trim()) return regulations;

    const term = searchTerm.toLowerCase().trim();
    return regulations.filter((r) => {
      const title = (r.title || '').toLowerCase();
      const category = (r.category || '').toLowerCase();
      const status = (r.status || '').toLowerCase();
      const description = (r.description || '').toLowerCase();
      const content = (r.content || '').toLowerCase();
      const ref = (r.ref || r.refNumber || r.referenceNo || '').toLowerCase();
      const adminNotes = (r.adminNotes || '').toLowerCase();

      return (
        title.includes(term) ||
        category.includes(term) ||
        status.includes(term) ||
        description.includes(term) ||
        content.includes(term) ||
        ref.includes(term) ||
        adminNotes.includes(term)
      );
    });
  }, [regulations, searchTerm]);

  /* -----------------------------
     PAGINATION
  ----------------------------- */
  const totalPages = Math.ceil(filteredRegulations.length / ITEMS_PER_PAGE);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRegulations.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRegulations, currentPage]);

  /* -----------------------------
     HELPERS
  ----------------------------- */
  const formatDate = (date) => {
    if (!date) return 'No deadline set';
    try {
      let dateObj;

      // Firestore Timestamp
      if (date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      } else if (date && date._seconds && typeof date._seconds === 'number') {
        dateObj = new Date(date._seconds * 1000);
      } else if (date && date.seconds && typeof date.seconds === 'number') {
        dateObj = new Date(date.seconds * 1000);
      } else if (date instanceof Date) {
        dateObj = date;
      } else {
        dateObj = new Date(date);
      }

      if (!dateObj || isNaN(dateObj.getTime())) return 'No deadline set';
      return format(dateObj, 'MMM d, yyyy');
    } catch (e) {
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
      <span
        className={`px-2 py-1 text-xs font-medium rounded ${
          map[key] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {label}
      </span>
    );
  };

  const openInAdminDashboard = (regulation, mode) => {
    router.push({
      pathname: '/dashboard/admin',
      query: { id: regulation.id, mode, from: 'actions-needed' }
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-12 w-12 border-t-2 border-blue-500 rounded-full" />
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="container mx-auto px-4 py-8">
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Actions Needed</h1>
        <p className="text-gray-500">
          All regulations requiring admin review/publish actions
        </p>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-lg border">
        <div className="p-6">
          <h2 className="text-lg font-semibold">All Regulations</h2>
          <p className="text-sm text-gray-500">
            Open a regulation in the Admin editor to manage deadlines, attachments, timeline, and publishing.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Title</th>
                <th className="px-6 py-3 text-left">Reference</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Deadline Assigned</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {paginatedData.map((r) => {
                // Download details (debug / export helper)
                const handleDownload = () => {
                  const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `regulation-${r.id || 'details'}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                };

                // Deadline (revisionDeadline for Needs Revision)
                const status = String(r.status || '').toLowerCase().trim();
                const deadline =
                  (status === 'needs revision' || status === 'needs_revision') && r.revisionDeadline
                    ? r.revisionDeadline
                    : r.deadline;

                const overdue = deadline
                  ? (() => {
                      try {
                        let dateObj;
                        if (deadline && typeof deadline.toDate === 'function') {
                          dateObj = deadline.toDate();
                        } else if (deadline && deadline._seconds) {
                          dateObj = new Date(deadline._seconds * 1000);
                        } else if (deadline && deadline.seconds) {
                          dateObj = new Date(deadline.seconds * 1000);
                        } else if (deadline instanceof Date) {
                          dateObj = deadline;
                        } else {
                          dateObj = new Date(deadline);
                        }
                        return dateObj && !isNaN(dateObj.getTime())
                          ? dateObj < new Date()
                          : false;
                      } catch (e) {
                        return false;
                      }
                    })()
                  : false;

                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 max-w-[380px]">
                      <div
                        className="text-left font-medium truncate max-w-[360px]"
                        title={r.title}
                      >
                        {r.title || '-'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {r.category || '—'}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {r.ref || r.refNumber || r.referenceNo || r.id?.substring(0, 8) || 'N/A'}
                    </td>

                    <td className="px-6 py-4">{getStatusBadge(r.status)}</td>

                    <td className={`px-6 py-4 ${overdue ? 'text-red-600 font-medium' : ''}`}>
                      {(() => {
                        const s = String(r.status || '').toLowerCase().trim();
                        if (s === 'published' || s === 'publish') return '—';
                        const d =
                          (s === 'needs revision' || s === 'needs_revision') && r.revisionDeadline
                            ? r.revisionDeadline
                            : r.deadline;
                        return formatDate(d);
                      })()}
                    </td>

                    <td className="px-6 py-4 text-right space-x-3">
                      <button
                        onClick={() => openInAdminDashboard(r, 'view')}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        title="View in Admin dashboard"
                      >
                        View
                      </button>

                      {(() => {
                        const status = String(r.status || '').toLowerCase().trim();
                        const isPendingPublish = status === 'pending publish' || status === 'pending_publish';
                        
                        if (!isPendingPublish) {
                          return (
                            <span
                              className="text-sm font-medium text-gray-400 cursor-not-allowed"
                              title="Only regulations in 'Pending Publish' state can be edited"
                            >
                              Edit
                            </span>
                          );
                        }
                        
                        return (
                          <button
                            onClick={() => openInAdminDashboard(r, 'edit')}
                            className="text-sm font-medium text-orange-600 hover:text-orange-800 hover:underline"
                            title="Edit in Admin dashboard"
                          >
                            Edit
                          </button>
                        );
                      })()}

                      <button
                        onClick={handleDownload}
                        className="text-green-600 hover:text-green-800 text-sm ml-2"
                        title="Download details"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 inline"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    {searchTerm
                      ? 'No regulations found matching your search.'
                      : 'No regulations found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 p-4 border-t">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50"
            >
              Prev
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`px-3 py-1 border rounded text-sm ${
                  currentPage === p ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
                }`}
              >
                {p}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActionsNeeded;
