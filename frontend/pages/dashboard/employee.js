import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useSearch } from '../../contexts/SearchContext';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { format } from 'date-fns';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { downloadRegulationPdf } from '../../lib/regulationPdf';

// Icons
const FileText = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-blue-500">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

const Clock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-yellow-500">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

const CheckCircle = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-green-500">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

const XCircle = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-red-500">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="15" y1="9" x2="9" y2="15"></line>
    <line x1="9" y1="9" x2="15" y2="15"></line>
  </svg>
);

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const { searchTerm } = useSearch();
  const router = useRouter();
  const [regulations, setRegulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState({
    drafts: 0,
    pending: 0,
    published: 0,
    rejected: 0
  });

  // Format date for display
  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      return format(date.toDate ? date.toDate() : new Date(date), 'MMM d, yyyy');
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'Invalid date';
    }
  };

  // Fetch regulations from Firestore
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    setLoading(true);
    
    // Query regulations for the current user
    console.log('Querying regulations for user:', user.uid);
    const q = query(
      collection(db, 'regulations'),
      where('createdBy', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        console.log('Query returned', querySnapshot.size, 'documents');
        querySnapshot.forEach((doc) => {
          console.log('Document:', {
            id: doc.id,
            ...doc.data(),
            createdBy: doc.data().createdBy,
            updatedAt: doc.data().updatedAt?.toDate?.()?.toString()
          });
        });
        
        const regs = [];
        const counts = {
          drafts: 0,
          pending: 0,
          published: 0,
          rejected: 0
        };

        querySnapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() };
          regs.push(data);
          // Update counts based on status
          const status = String(data.status || '').trim().toLowerCase();
          if (status === 'draft') counts.drafts++;
          else if (status === 'pending review' || status === 'pending_review' || status === 'under review' || status === 'under_review') counts.pending++;
          else if (status === 'published' || status === 'publish' || status === 'approved' || status === 'pending publish' || status === 'pending_publish') counts.published++;
          else if (status === 'rejected' || status === 'needs revision' || status === 'needs_revision') counts.rejected++;
        });

        setRegulations(regs);
        setMetrics(counts);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching regulations:', error);
        setError('Failed to load regulations. Please try again later.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, router]);

  // Filter regulations based on search term
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

  const getStatusBadge = (status, regulation) => {
    const baseClasses = "px-2 py-1 text-xs font-medium rounded";
    
    switch (status) {
      case 'Draft':
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status}</span>;
      case 'Pending Review':
        return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>{status}</span>;
      case 'Approved':
        return <span className={`${baseClasses} bg-green-100 text-green-800`}>{status}</span>;
      case 'Published':
        return <span className={`${baseClasses} bg-green-100 text-green-800`}>{status}</span>;
      case 'Rejected':
      case 'Needs Revision':
        return (
          <div className="flex flex-col gap-1">
            <span className={`${baseClasses} bg-red-100 text-red-800`}>{status}</span>
            {regulation.revisionDeadline && (
              <span className="text-xs text-red-600 font-medium mt-1">
                Due: {formatDate(regulation.revisionDeadline)}
              </span>
            )}
          </div>
        );
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status || 'N/A'}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600">
        <p>Error: {error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Employee Dashboard</h1>
        <p className="text-gray-500">Welcome back! Here's what's happening with your regulations.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Drafts in Progress */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Drafts in Progress</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.drafts}</p>
              <p className="text-xs text-gray-500 mt-1">+2 from last month</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <FileText />
            </div>
          </div>
        </div>

        {/* Pending Review */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Pending Review</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.pending}</p>
              <p className="text-xs text-gray-500 mt-1">+1 from last month</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
              <Clock />
            </div>
          </div>
        </div>

        {/* Published */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Published</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.published}</p>
              <p className="text-xs text-gray-500 mt-1">+3 from last month</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle />
            </div>
          </div>
        </div>

        {/* Rejected / Needs Revision */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Rejected / Needs Revision</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.rejected}</p>
              <p className="text-xs text-gray-500 mt-1">+0 from last month</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle />
            </div>
          </div>
        </div>
      </div>

      {/* Activity Table */}
      <div className="bg-white rounded-lg border">
        <div className="p-6">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <p className="text-sm text-gray-500">Your recent regulation activities</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {regulations.some(r => r.status === 'Needs Revision') ? 'Revision Due' : 'Deadline'}
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Download
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRegulations.map((regulation) => (
                <tr key={regulation.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{regulation.title || 'Untitled Regulation'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(regulation.status, regulation)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {regulation.updatedAt ? formatDate(regulation.updatedAt) : 'N/A'}
                    {regulation.status === 'Needs Revision' && regulation.adminNotes && (
                      <div className="mt-1 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                        <p className="font-medium">Admin Notes:</p>
                        <p className="whitespace-pre-wrap">{regulation.adminNotes}</p>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                    {(() => {
                      const status = String(regulation.status || '').toLowerCase().trim();
                      if (status === 'published' || status === 'publish') {
                        return '—';
                      }
                      if (regulation.status === 'Needs Revision' && regulation.revisionDeadline) {
                        return (
                          <span className="font-medium text-red-600">
                            {formatDate(regulation.revisionDeadline)}
                          </span>
                        );
                      }
                      if (regulation.deadline) {
                        return formatDate(regulation.deadline);
                      }
                      return 'No deadline';
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await downloadRegulationPdf(regulation.id, regulation);
                        } catch (e) {
                          console.error(e);
                          alert("Failed to download PDF. Please try again.");
                        }
                      }}
                      className="px-3 py-1.5 rounded-md text-xs font-medium border border-gray-300 bg-white hover:bg-gray-50"
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRegulations.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                    {searchTerm 
                      ? 'No regulations found matching your search.' 
                      : 'No regulations found. Create your first regulation to get started.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

