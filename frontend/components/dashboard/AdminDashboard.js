import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  arrayUnion,
  getDoc
} from 'firebase/firestore';
import { toast } from 'react-toastify';

const AdminDashboard = () => {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [regulations, setRegulations] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState(null);
  const [selectedRegulation, setSelectedRegulation] = useState(null);
  const [selectedReviewer, setSelectedReviewer] = useState('');
  const [versionNotes, setVersionNotes] = useState('');
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
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchReviewers = async () => {
    const q = query(collection(db, 'users'), where('role', 'in', ['reviewer', 'admin']));
    const querySnapshot = await getDocs(q);
    const reviewersData = [];
    
    querySnapshot.forEach((doc) => {
      if (doc.id !== user.uid) { // Don't show current admin in the list
        reviewersData.push({ id: doc.id, ...doc.data() });
      }
    });
    
    setReviewers(reviewersData);
  };

  const fetchRegulations = async () => {
    const q = query(collection(db, 'regulations'));
    const querySnapshot = await getDocs(q);
    const regulationsData = [];
    
    querySnapshot.forEach((doc) => {
      regulationsData.push({ id: doc.id, ...doc.data() });
    });
    
    setRegulations(regulationsData);
  };

  const handleAssignReviewer = async () => {
    if (!selectedReviewer) {
      toast.error('Please select a reviewer');
      return;
    }

    try {
      setIsSubmitting(true);
      const regulationRef = doc(db, 'regulations', selectedRegulation.id);
      const reviewerDoc = await getDoc(doc(db, 'users', selectedReviewer));
      
      if (!reviewerDoc.exists()) {
        throw new Error('Selected reviewer not found');
      }

      await updateDoc(regulationRef, {
        assignedReviewer: selectedReviewer,
        assignedReviewerName: reviewerDoc.data().name || 'Reviewer',
        status: 'pending_review',
        lastUpdated: new Date()
      });

      toast.success('Reviewer assigned successfully');
      setSelectedAction(null);
      fetchRegulations();
    } catch (error) {
      console.error('Error assigning reviewer:', error);
      toast.error('Failed to assign reviewer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!versionNotes.trim()) {
      toast.error('Please provide version notes');
      return;
    }

    try {
      setIsSubmitting(true);
      const regulationRef = doc(db, 'regulations', selectedRegulation.id);
      const currentVersion = selectedRegulation.version || 1;
      const now = new Date();

      await updateDoc(regulationRef, {
        status: 'published',
        version: currentVersion + 1,
        publishedAt: now,
        lastUpdated: now,
        isActive: true,
        versionHistory: arrayUnion({
          version: currentVersion,
          updatedAt: now,
          notes: versionNotes,
          status: 'published',
          publishedBy: user.uid,
          publishedByName: user.displayName || 'Admin'
        })
      });

      toast.success('Regulation published successfully');
      setSelectedAction(null);
      setVersionNotes('');
      fetchRegulations();
    } catch (error) {
      console.error('Error publishing regulation:', error);
      toast.error('Failed to publish regulation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      draft: 'bg-gray-100 text-gray-800',
      pending_review: 'bg-yellow-100 text-yellow-800',
      under_review: 'bg-blue-100 text-blue-800',
      needs_revision: 'bg-orange-100 text-orange-800',
      published: 'bg-green-100 text-green-800',
      archived: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${statusClasses[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Regulations Management</h2>
        
        {regulations.length === 0 ? (
          <p className="text-gray-500">No regulations found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-2 px-4 border-b border-gray-200 text-left">Title</th>
                  <th className="py-2 px-4 border-b border-gray-200 text-left">Category</th>
                  <th className="py-2 px-4 border-b border-gray-200 text-left">Status</th>
                  <th className="py-2 px-4 border-b border-gray-200 text-left">Version</th>
                  <th className="py-2 px-4 border-b border-gray-200 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {regulations.map((regulation) => (
                  <tr key={regulation.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 border-b border-gray-200">{regulation.title}</td>
                    <td className="py-3 px-4 border-b border-gray-200">{regulation.category}</td>
                    <td className="py-3 px-4 border-b border-gray-200">
                      {getStatusBadge(regulation.status)}
                    </td>
                    <td className="py-3 px-4 border-b border-gray-200">{regulation.version || '1.0'}</td>
                    <td className="py-3 px-4 border-b border-gray-200 space-x-2">
                      {regulation.status === 'draft' && (
                        <button
                          onClick={() => {
                            setSelectedRegulation(regulation);
                            setSelectedAction('assign');
                          }}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                        >
                          Assign Reviewer
                        </button>
                      )}
                      
                      {regulation.status === 'under_review' && (
                        <button
                          onClick={() => {
                            setSelectedRegulation(regulation);
                            setSelectedAction('publish');
                          }}
                          className="text-green-600 hover:text-green-800 font-medium text-sm"
                        >
                          Publish
                        </button>
                      )}
                      
                      {regulation.status === 'published' && (
                        <button
                          onClick={() => {
                            // View details or edit
                            router.push(`/view-regulation?id=${regulation.id}`);
                          }}
                          className="text-purple-600 hover:text-purple-800 font-medium text-sm"
                        >
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Reviewer Modal */}
      {selectedAction === 'assign' && selectedRegulation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">
              Assign Reviewer for: {selectedRegulation.title}
            </h2>
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Select Reviewer</label>
              <select
                value={selectedReviewer}
                onChange={(e) => setSelectedReviewer(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select a reviewer</option>
                {reviewers.map((reviewer) => (
                  <option key={reviewer.id} value={reviewer.id}>
                    {reviewer.name || reviewer.email} ({reviewer.role})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedAction(null);
                  setSelectedReviewer('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignReviewer}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                disabled={isSubmitting || !selectedReviewer}
              >
                {isSubmitting ? 'Assigning...' : 'Assign Reviewer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publish Modal */}
      {selectedAction === 'publish' && selectedRegulation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">
              Publish: {selectedRegulation.title}
            </h2>
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Version Notes</label>
              <textarea
                value={versionNotes}
                onChange={(e) => setVersionNotes(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="Enter version notes..."
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Current version: {selectedRegulation.version || '1.0'}. New version will be {selectedRegulation.version ? selectedRegulation.version + 1 : '2.0'}
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedAction(null);
                  setVersionNotes('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublish}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                disabled={isSubmitting || !versionNotes.trim()}
              >
                {isSubmitting ? 'Publishing...' : 'Publish Regulation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
