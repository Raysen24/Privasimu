"use client";

import { useRegulationStore } from "../store/regulationStore";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../contexts/AuthContext";
import { parseDate, formatDate } from "../lib/dateUtils";

// Dynamically import ReactQuill (for client-side only)
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });
import "react-quill/dist/quill.snow.css";

export default function EditRegulation() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  
  const fetchRegulation = useRegulationStore((state) => state.fetchRegulation);
  const updateRegulation = useRegulationStore((state) => state.updateRegulation);
  const deleteRegulation = useRegulationStore((state) => state.deleteRegulation);
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    code: "",
    ref: "",
    refNumber: "",
    description: "",
    notes: "",
    version: "v1.0",
    status: "",
    attachments: [],
    deadline: null,
    revisionDeadline: null,
    adminNotes: "",
    feedback: "",
    reviewerFeedback: "",
  });
  const [isSaved, setIsSaved] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attachmentLabel, setAttachmentLabel] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");

  // Format date for display (date only)
  const formatDateForDisplay = (dateValue) => {
    const date = parseDate(dateValue);
    return date ? formatDate(dateValue) : '';
  };

  // Fetch the regulation from API
  useEffect(() => {
    if (id) {
      setLoading(true);
      fetchRegulation(id)
        .then((regulation) => {
          // Get raw deadline from _original or deadlineRaw
          const rawDeadline = regulation._original?.deadline || regulation.deadlineRaw || regulation.deadline;
          const rawRevisionDeadline = regulation._original?.revisionDeadline || regulation.revisionDeadline;
          
          // Get reference number from multiple possible sources
          const referenceNumber = regulation.ref || regulation.refNumber || regulation.code || regulation._original?.ref || regulation._original?.refNumber || regulation._original?.code || "";
          
          setFormData({
            title: regulation.title || "",
            category: regulation.category || "",
            code: referenceNumber, // Use the reference number
            ref: regulation.ref || regulation.refNumber || "",
            refNumber: regulation.refNumber || regulation.ref || "",
            description: regulation.description || "",
            notes: regulation.notes || "",
            version: regulation.version || "v1.0",
            status: regulation.status || "",
            attachments: regulation.attachments || [],
            deadline: rawDeadline || null,
            revisionDeadline: rawRevisionDeadline || null,
            adminNotes: regulation.adminNotes || "",
            feedback: regulation.feedback || regulation.reviewerFeedback || "",
            reviewerFeedback: regulation.reviewerFeedback || "",
          });
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [id, fetchRegulation]);

  const handleFieldChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleAddAttachment = () => {
    if (!attachmentLabel.trim() || !attachmentUrl.trim()) {
      alert("Please provide both a label and URL for the attachment.");
      return;
    }

    try {
      const url = new URL(attachmentUrl.trim());
      setFormData(prev => ({
        ...prev,
        attachments: [
          ...(Array.isArray(prev.attachments) ? prev.attachments : []),
          { name: attachmentLabel.trim(), url: url.toString() },
        ],
      }));
      setAttachmentLabel("");
      setAttachmentUrl("");
    } catch (error) {
      alert("Please enter a valid URL (e.g., https://example.com/document.pdf).");
    }
  };

  const handleRemoveAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.title || !formData.category) {
      alert("Please fill in all required fields (Title and Category)");
      return;
    }
    
    try {
      // Prepare update payload - convert deadline to ISO string if it exists
      const updatePayload = { ...formData };
      
      // Handle deadline conversion
      if (updatePayload.deadline) {
        const deadlineDate = parseDate(updatePayload.deadline);
        if (deadlineDate && !isNaN(deadlineDate.getTime())) {
          updatePayload.deadline = deadlineDate.toISOString();
        } else {
          // If deadline can't be parsed, set it to null
          updatePayload.deadline = null;
        }
      } else {
        updatePayload.deadline = null;
      }
      
      // Don't send fields that belong to admins/reviewers
      delete updatePayload.revisionDeadline;
      delete updatePayload.adminNotes;
      delete updatePayload.feedback;
      delete updatePayload.reviewerFeedback;
      
      // Update the regulation via API
      await updateRegulation(id, updatePayload);
      
      console.log("Regulation updated successfully:", updatePayload);
      setIsSaved(true);
      
      // Wait a moment for the store update to propagate, then navigate
      setTimeout(() => {
        setIsSaved(false);
        // Add timestamp to force refresh and bypass any remaining cache
        router.push(`/regulations?refresh=${Date.now()}`);
      }, 500); // Reduced from 1500ms to 500ms for faster navigation
    } catch (err) {
      console.error('Error updating regulation:', err);
      alert(`Failed to update regulation: ${err.message}`);
    }
  };

  const handleCancel = () => {
    if (window.confirm("Are you sure you want to discard your changes?")) {
      router.push("/regulations");
    }
  };

  const handleDeleteDraft = async () => {
    if (window.confirm("Are you sure you want to delete this draft? This action cannot be undone.")) {
      setIsDeleting(true);
      try {
        await deleteRegulation(id);
        router.push("/regulations");
      } catch (error) {
        console.error("Error deleting draft:", error);
        alert(`Failed to delete draft: ${error.message}`);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // Show loading if regulation not found yet
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

  if (error) {
    return (
      <div className="p-8">
        <div className="text-center">
          <p className="text-red-600">Error: {error}</p>
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

  if (!formData.title) {
    return (
      <div className="p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading regulation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Edit Regulation</h1>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDeleteDraft}
            disabled={isDeleting}
            className="px-4 py-2 border border-red-600 text-red-600 rounded-md text-sm hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? 'Deleting...' : 'Delete Draft'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            Update Regulation
          </button>
        </div>
      </div>

      {isSaved && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          Regulation updated successfully! Redirecting...
        </div>
      )}

      {/* Feedback from reviewer/admin */}
      {(() => {
        const reviewerText = (formData.feedback || formData.reviewerFeedback || "").trim();
        const adminText = (formData.adminNotes || "").trim();
        if (!reviewerText && !adminText) return null;
        return (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviewerText && (
              <div className="border border-blue-200 bg-blue-50 p-4 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">Reviewer Feedback</h3>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{reviewerText}</p>
              </div>
            )}
            {adminText && (
              <div className="border border-amber-200 bg-amber-50 p-4 rounded-lg">
                <h3 className="text-sm font-semibold text-amber-800 mb-2">Admin Notes</h3>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{adminText}</p>
              </div>
            )}
          </div>
        );
      })()}

      <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleFieldChange("title", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select
            value={formData.category}
            onChange={(e) => handleFieldChange("category", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select Category</option>
            <option value="HR">HR</option>
            <option value="Finance">Finance</option>
            <option value="IT">IT</option>
            <option value="Operations">Operations</option>
            <option value="Legal">Legal</option>
            <option value="Compliance">Compliance</option>
          </select>
        </div>

        {/* Reference Number (Read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Reference Number</label>
          <div className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono">
            <span className="font-semibold text-blue-600">
              {formData.code || formData.ref || formData.refNumber || 'N/A'}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">Reference number cannot be modified</p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <ReactQuill
            value={formData.description}
            onChange={(value) => handleFieldChange("description", value)}
            className="bg-white"
            theme="snow"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleFieldChange("notes", e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>


        {/* Version */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Version</label>
          <input
            type="text"
            value={formData.version}
            onChange={(e) => handleFieldChange("version", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Deadline - Editable for admins, read-only for others - Hidden when Published */}
        {formData.status !== 'Published' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Deadline
            </label>
            {user?.role === 'admin' ? (
            <div className="relative">
              <input
                type="datetime-local"
                value={(() => {
                  try {
                    if (!formData.deadline) return '';
                    const date = parseDate(formData.deadline);
                    return date ? date.toISOString().slice(0, 16) : '';
                  } catch (e) {
                    console.error('Error formatting deadline:', e);
                    return '';
                  }
                })()}
                onChange={(e) => {
                  try {
                    const date = e.target.value ? new Date(e.target.value) : null;
                    handleFieldChange('deadline', date && !isNaN(date.getTime()) ? date.toISOString() : null);
                  } catch (e) {
                    console.error('Error handling date change:', e);
                    handleFieldChange('deadline', null);
                  }
                }}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                min={new Date().toISOString().slice(0, 16)}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          ) : (
            (() => {
              try {
                if (!formData.deadline) return null;
                const date = parseDate(formData.deadline);
                if (!date) return null;
                return (
                  <p className="text-sm text-gray-600">
                    {date.toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                );
              } catch (e) {
                console.error('Error formatting date:', e);
                return null;
              }
            })()
          )}
            {user?.role === 'admin' && (
              <p className="mt-1 text-xs text-gray-500">
                Set the deadline for this regulation
              </p>
            )}
          </div>
        )}

        {/* Revision Information - Only show if status is 'Needs Revision' */}
        {formData.status === 'Needs Revision' && (
          <div className="border-l-4 border-red-500 bg-red-50 p-4 rounded-r">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Revision Required</h3>
            
            {formData.revisionDeadline && (
              <div className="mb-3">
                <p className="text-sm font-medium text-red-700">Revision Deadline:</p>
                <p className="text-sm text-red-800 font-semibold">
                  {formatDateForDisplay(formData.revisionDeadline)}
                </p>
                <p className="text-xs text-red-600 mt-1">
                  {(() => {
                    if (!formData.revisionDeadline) return '';
                    const deadlineDate = parseDate(formData.revisionDeadline);
                    if (!deadlineDate) return '';
                    
                    const now = new Date();
                    const diffTime = deadlineDate - now;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (isNaN(diffDays)) return '';
                    
                    if (diffTime < 0) {
                      return `Deadline was ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} ago`;
                    } else if (diffDays === 0) {
                      return 'Due today';
                    } else if (diffDays === 1) {
                      return 'Due tomorrow';
                    } else {
                      return `Due in ${diffDays} days`;
                    }
                  })()}
                </p>
              </div>
            )}
            
            {formData.adminNotes && (
              <div>
                <p className="text-sm font-medium text-red-700 mb-1">Admin Notes:</p>
                <div className="bg-white p-3 rounded border border-red-200 text-sm text-gray-800 whitespace-pre-wrap">
                  {formData.adminNotes}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Attachments */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Attachments</label>
          <div className="border border-dashed border-gray-300 rounded-lg p-4 space-y-3">
            <p className="text-sm text-gray-600">
              Add or remove external links for supporting documents.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Attachment name"
                value={attachmentLabel}
                onChange={(e) => setAttachmentLabel(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="url"
                placeholder="https://..."
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="button"
              onClick={handleAddAttachment}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              Add Attachment Link
            </button>
            {Array.isArray(formData.attachments) && formData.attachments.length > 0 && (
              <ul className="divide-y divide-gray-200">
                {formData.attachments.map((attachment, index) => (
                  <li key={`${attachment.url}-${index}`} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium">{attachment.name || `Attachment ${index + 1}`}</p>
                      <p className="text-xs text-gray-500 truncate max-w-xs">{attachment.url}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(index)}
                      className="text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={handleCancel}
            className="px-6 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            Update Regulation
          </button>
        </div>
      </form>
    </div>
  );
}
