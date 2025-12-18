import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, getDocs, doc, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { toast } from 'react-toastify';

const ITEMS_PER_PAGE = 8;

const ActionsNeeded = () => {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [regulations, setRegulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRegulation, setSelectedRegulation] = useState(null);
  const [viewMode, setViewMode] = useState(false); // true = view only, false = edit mode
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      fetchRegulations();
    }
  }, [isLoading, user]);

  const fetchRegulations = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'regulations'));
      const snap = await getDocs(q);
      const data = [];
      snap.forEach((d) => data.push({ id: d.id, ...d.data() }));
      setRegulations(data);
    } catch (e) {
      toast.error('Failed to load regulations');
    } finally {
      setLoading(false);
    }
  };

  /* -----------------------------
     PAGINATION
  ----------------------------- */
  const totalPages = Math.ceil(regulations.length / ITEMS_PER_PAGE);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return regulations.slice(start, start + ITEMS_PER_PAGE);
  }, [regulations, currentPage]);

  /* -----------------------------
     HELPERS
  ----------------------------- */
  const formatDate = (date) => {
    if (!date) return '—';
    return format(date.toDate ? date.toDate() : new Date(date), 'MMM d, yyyy');
  };

  const getStatusBadge = (status) => {
    const map = {
      draft: 'bg-gray-100 text-gray-800',
      pending_review: 'bg-yellow-100 text-yellow-800',
      under_review: 'bg-blue-100 text-blue-800',
      needs_revision: 'bg-red-100 text-red-800',
      published: 'bg-green-100 text-green-800'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${map[status]}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const handleEditClick = (regulation) => {
    setSelectedRegulation(regulation);
    setViewMode(false);
    setNotes('');
  };

  const handleViewClick = (regulation) => {
    setSelectedRegulation(regulation);
    setViewMode(true);
    setNotes('');
  };

  const handlePublish = async () => {
    if (!selectedRegulation) return;

    try {
      setSubmitting(true);
      await updateDoc(doc(db, 'regulations', selectedRegulation.id), {
        status: 'published',
        adminNotes: notes,
        publishedAt: new Date()
      });

      toast.success('Regulation published successfully!');
      setSelectedRegulation(null);
      setNotes('');
      fetchRegulations();
    } catch (e) {
      toast.error('Failed to publish regulation');
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeny = async () => {
    if (!selectedRegulation) return;

    try {
      setSubmitting(true);
      await updateDoc(doc(db, 'regulations', selectedRegulation.id), {
        status: 'needs_revision',
        adminNotes: notes,
        deniedAt: new Date()
      });

      toast.info('Regulation marked for revision');
      setSelectedRegulation(null);
      setNotes('');
      fetchRegulations();
    } catch (e) {
      toast.error('Failed to update regulation');
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-12 w-12 border-t-2 border-blue-500 rounded-full" />
      </div>
    );
  }

  // DETAIL VIEW (both view and edit modes)
  if (selectedRegulation) {
    return (
      <div className="container mx-auto px-4 py-8">
        <button
          onClick={() => setSelectedRegulation(null)}
          className="mb-6 px-4 py-2 text-blue-600 hover:text-blue-800 font-medium"
        >
          ← Back to List
        </button>

        <div className="grid grid-cols-3 gap-6">
          {/* Left: Regulation Details */}
          <div className="col-span-2 bg-white rounded-lg border p-6">
            <h2 className="text-2xl font-bold mb-4">{selectedRegulation.title}</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700">Category</label>
                <p className="text-gray-900">{selectedRegulation.category || 'N/A'}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Status</label>
                <div className="mt-1">{getStatusBadge(selectedRegulation.status)}</div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Deadline</label>
                <p className="text-gray-900">{formatDate(selectedRegulation.deadline)}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Description</label>
                <p className="text-gray-900 whitespace-pre-wrap">{selectedRegulation.description || 'N/A'}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Content</label>
                <p className="text-gray-900 whitespace-pre-wrap">{selectedRegulation.content || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Right: Notes & Actions */}
          <div className="col-span-1 bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold mb-4">Admin Notes</h3>

            {viewMode ? (
              // VIEW MODE - Read-only
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 min-h-40">
                <p className="text-gray-900 whitespace-pre-wrap">
                  {selectedRegulation.adminNotes || 'No notes added'}
                </p>
              </div>
            ) : (
              // EDIT MODE - Editable textarea
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add your notes here..."
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            )}

            <div className="space-y-3 mt-6">
              {!viewMode && (
                <>
                  <button
                    onClick={handlePublish}
                    disabled={submitting}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                  >
                    {submitting ? 'Publishing...' : 'Publish'}
                  </button>

                  <button
                    onClick={handleDeny}
                    disabled={submitting}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
                  >
                    {submitting ? 'Denying...' : 'Deny'}
                  </button>
                </>
              )}

              {viewMode && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700">
                    This is a read-only view. Publish/Deny is not available.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
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
          Complete list of regulations requiring admin actions
        </p>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-lg border">
        <div className="p-6">
          <h2 className="text-lg font-semibold">All Regulations</h2>
          <p className="text-sm text-gray-500">
            View, edit, and manage all regulations
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
                  Deadline
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {paginatedData.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">{r.title}</td>
                  <td className="px-6 py-4">{getStatusBadge(r.status)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(r.deadline)}
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <button
                      onClick={() => handleViewClick(r)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View
                    </button>

                    <button
                      onClick={() => handleEditClick(r)}
                      className="text-orange-600 hover:underline text-sm"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}

              {paginatedData.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    No regulations found.
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
                  currentPage === p
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-100'
                }`}
              >
                {p}
              </button>
            ))}

            <button
              onClick={() =>
                setCurrentPage((p) => Math.min(p + 1, totalPages))
              }
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