import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
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
  const router = useRouter();

  const [regulations, setRegulations] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals / actions
  const [selectedAction, setSelectedAction] = useState(null);
  const [selectedRegulation, setSelectedRegulation] = useState(null);
  const [detailMode, setDetailMode] = useState(null);
  const [selectedReviewer, setSelectedReviewer] = useState('');
  const [versionNotes, setVersionNotes] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
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
      console.error('Admin dashboard load failed:', e);
      toast.error(`Failed to load admin data: ${e?.message || 'unknown error'}`);
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
    snap.forEach((d) => data.push({ id: d.id, ...d.data() }));
    setRegulations(data);
  };

  /* -----------------------------
     GRAPH DATA (Drafts / Submitted / Published / Rejected per month)
  ----------------------------- */
  const chartData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: format(new Date(2025, i, 1), 'MMM'),
      drafts: 0,
      submitted: 0,
      published: 0,
      rejected: 0
    }));

    regulations.forEach((r) => {
      if (!r.updatedAt?.toDate) return;

      const monthIndex = r.updatedAt.toDate().getMonth();
      const s = normalizeStatus(r.status);

      if (s === 'draft') months[monthIndex].drafts++;
      if (
        ['pending_review', 'under_review', 'pending_approval', 'pending_publish']
          .includes(s)
      ) {
        months[monthIndex].submitted++;
      }
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
    if (!date) return '—';
    return format(date.toDate ? date.toDate() : new Date(date), 'MMM d, yyyy');
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
    setAdminNotes('');
  };

  const openEdit = (r) => {
    setSelectedRegulation(r);
    setDetailMode('edit');
    setAdminNotes(r.adminNotes || '');
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
    try {
      setIsSubmitting(true);
      const ref = doc(db, 'regulations', selectedRegulation.id);
      const now = new Date();
      await updateDoc(ref, {
        status: 'Needs Revision',
        adminNotes: adminNotes,
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-12 w-12 border-t-2 border-blue-500 rounded-full" />
      </div>
    );
  }

  if (selectedRegulation && detailMode) {
    return (
      <div className="container mx-auto px-4 py-8">
        {/* DETAIL VIEW — UNCHANGED */}
      </div>
    );
  }

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

              <Line type="monotone" dataKey="drafts" stroke="#6b7280" strokeWidth={2} />
              <Line type="monotone" dataKey="submitted" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="published" stroke="#22c55e" strokeWidth={2} />
              <Line type="monotone" dataKey="rejected" stroke="#ef4444" strokeWidth={2} />
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
                  Deadline
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {regulations.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">{r.title}</td>
                  <td className="px-6 py-4">{getStatusBadge(r.status)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(r.deadline)}
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

                    {normalizeStatus(r.status) === 'draft' && (
                      <button
                        onClick={() => {
                          setSelectedRegulation(r);
                          setSelectedAction('assign');
                        }}
                        className="text-green-600 hover:underline text-sm"
                      >
                        Assign
                      </button>
                    )}
                  </td>
                </tr>
              ))}
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