"use client";

import { useRegulationStore } from "../store/regulationStore";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { useSearch } from "../contexts/SearchContext";

// Helper function to format Firestore timestamps
const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'Date not available';
  
  try {
    // Handle Firestore timestamp format
    const date = timestamp._seconds 
      ? new Date(timestamp._seconds * 1000)
      : new Date(timestamp);
      
    if (isNaN(date.getTime())) return 'Invalid date';
    
    return date.toLocaleString('en-US', { 
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    console.error('Error formatting date:', e);
    return 'Date not available';
  }
};

export default function ViewRegulation() {
  const router = useRouter();
  const { id } = router.query;
  
  const fetchRegulation = useRegulationStore((state) => state.fetchRegulation);
  const { searchTerm, setSearchTerm } = useSearch();
  const [regulation, setRegulation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch the regulation from API
  useEffect(() => {
    if (id) {
      setLoading(true);
      fetchRegulation(id)
        .then((data) => {
          setRegulation(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [id, fetchRegulation]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading regulation...</p>
        </div>
      </div>
    );
  }

  if (error || !regulation) {
    return (
      <div className="p-8">
        <div className="text-center">
          <p className="text-red-600">Error: {error || "Regulation not found"}</p>
          <button
            onClick={() => router.push("/regulations")}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Regulations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">View Regulation</h1>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search other regulations"
              className="w-64 px-4 py-2 pl-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-4 w-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
          <button
            onClick={() => router.push("/regulations")}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
          >
            Back to Regulations
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* Header Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">{regulation.title}</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <p><span className="font-medium">Reference:</span> {regulation.ref || 'N/A'}</p>
              <p><span className="font-medium">Category:</span> {regulation.category || 'N/A'}</p>
            </div>
          </div>
          <div>
            <div className="space-y-2 text-sm text-gray-600">
              <p><span className="font-medium">Status:</span> 
                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                  regulation.status === 'Published' ? 'bg-green-100 text-green-800' :
                  regulation.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' :
                  regulation.status === 'Needs Revision' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {regulation.status}
                </span>
              </p>
              <p><span className="font-medium">Version:</span> {regulation.version}</p>
              <p><span className="font-medium">Deadline:</span> {regulation.deadline}</p>
            </div>
          </div>
        </div>

        {/* Description */}
        {regulation.description && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Description</h3>
            <div 
              className="prose max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: regulation.description }}
            />
          </div>
        )}

        {/* Notes */}
        {regulation.notes && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Notes</h3>
            <div className="bg-gray-50 rounded-lg p-4 text-gray-700">
              {regulation.notes}
            </div>
          </div>
        )}

        {/* Attachments */}
        {Array.isArray(regulation.attachments) && regulation.attachments.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Attachments</h3>
            <div className="bg-white border border-gray-200 rounded-lg divide-y">
              {regulation.attachments.map((attachment, index) => (
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

        {/* Feedback */}
        {regulation.feedback && regulation.feedback !== "-" && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Reviewer Feedback</h3>
            <div className="bg-blue-50 rounded-lg p-4 text-gray-700">
              {regulation.feedback}
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Timeline</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <p className="flex items-center">
              <svg className="h-4 w-4 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="font-medium">Submitted: </span>
              <span className="ml-1">
                {formatTimestamp(regulation.submittedAt || regulation.createdAt)}
              </span>
            </p>
            {regulation.reviewedAt && (
              <p className="flex items-center">
                <svg className="h-4 w-4 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">Reviewed: </span>
                <span className="ml-1">
                  {formatTimestamp(regulation.reviewedAt)}
                </span>
              </p>
            )}
            {regulation.publishedAt && (
              <p className="flex items-center">
                <svg className="h-4 w-4 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span className="font-medium">Published: </span>
                <span className="ml-1">
                  {formatTimestamp(regulation.publishedAt)}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
