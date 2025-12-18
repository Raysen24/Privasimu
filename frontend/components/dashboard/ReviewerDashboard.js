import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { toast } from 'react-toastify';

const ReviewerDashboard = () => {
  const { user, isReviewer } = useAuth();
  const router = useRouter();
  const [regulations, setRegulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegulation, setSelectedRegulation] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [status, setStatus] = useState('needs_changes');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isReviewer()) {
      router.push('/unauthorized');
      return;
    }
    fetchRegulations();
  }, [isReviewer, router]);

  const fetchRegulations = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'regulations'), 
        where('status', 'in', ['pending_review', 'needs_revision']));
      
      const querySnapshot = await getDocs(q);
      const regulationsData = [];
      
      querySnapshot.forEach((doc) => {
        regulationsData.push({ id: doc.id, ...doc.data() });
      });
      
      setRegulations(regulationsData);
    } catch (error) {
      console.error('Error fetching regulations:', error);
      toast.error('Failed to load regulations');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!feedback.trim()) {
      toast.error('Please provide feedback');
      return;
    }

    try {
      setIsSubmitting(true);
      const regulationRef = doc(db, 'regulations', selectedRegulation.id);
      
      await updateDoc(regulationRef, {
        status: status === 'approved' ? 'under_review' : 'needs_revision',
        lastUpdated: new Date(),
        reviews: arrayUnion({
          reviewerId: user.uid,
          reviewerName: user.displayName || 'Reviewer',
          feedback,
          status,
          reviewedAt: new Date()
        })
      });

      toast.success(`Regulation ${status === 'approved' ? 'approved' : 'sent for revision'}`);
      setSelectedRegulation(null);
      setFeedback('');
      fetchRegulations();
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
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
      <h1 className="text-2xl font-bold mb-6">Reviewer Dashboard</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Regulations for Review</h2>
        
        {regulations.length === 0 ? (
          <p className="text-gray-500">No regulations require review at this time.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-2 px-4 border-b border-gray-200 text-left">Title</th>
                  <th className="py-2 px-4 border-b border-gray-200 text-left">Category</th>
                  <th className="py-2 px-4 border-b border-gray-200 text-left">Status</th>
                  <th className="py-2 px-4 border-b border-gray-200 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {regulations.map((regulation) => (
                  <tr key={regulation.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 border-b border-gray-200">{regulation.title}</td>
                    <td className="py-3 px-4 border-b border-gray-200">{regulation.category}</td>
                    <td className="py-3 px-4 border-b border-gray-200">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                        regulation.status === 'pending_review' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {regulation.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 border-b border-gray-200">
                      <button
                        onClick={() => setSelectedRegulation(regulation)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedRegulation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-xl font-semibold mb-4">
              Review: {selectedRegulation.title}
            </h2>
            
            <form onSubmit={handleReviewSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Your Feedback</label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={5}
                  placeholder="Provide your feedback here..."
                  required
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-gray-700 mb-2">Decision</label>
                <div className="flex space-x-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      className="form-radio text-blue-600"
                      name="status"
                      value="approved"
                      checked={status === 'approved'}
                      onChange={() => setStatus('approved')}
                    />
                    <span className="ml-2">Approve</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      className="form-radio text-red-600"
                      name="status"
                      value="needs_changes"
                      checked={status === 'needs_changes'}
                      onChange={() => setStatus('needs_changes')}
                    />
                    <span className="ml-2">Needs Changes</span>
                  </label>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setSelectedRegulation(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewerDashboard;
