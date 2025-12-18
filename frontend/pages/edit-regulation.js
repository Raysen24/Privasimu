"use client";

import { useRegulationStore } from "../store/regulationStore";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";

// Dynamically import ReactQuill (for client-side only)
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });
import "react-quill/dist/quill.snow.css";

export default function EditRegulation() {
  const router = useRouter();
  const { id } = router.query;
  
  const fetchRegulation = useRegulationStore((state) => state.fetchRegulation);
  const updateRegulation = useRegulationStore((state) => state.updateRegulation);
  const deleteRegulation = useRegulationStore((state) => state.deleteRegulation);
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    code: "",
    description: "",
    notes: "",
    version: "v1.0",
    attachments: [],
  });
  const [isSaved, setIsSaved] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attachmentLabel, setAttachmentLabel] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");

  // Fetch the regulation from API
  useEffect(() => {
    if (id) {
      setLoading(true);
      fetchRegulation(id)
        .then((regulation) => {
          // Format dates for input fields (YYYY-MM-DD)
          const formatDateForInput = (dateStr) => {
            if (!dateStr || dateStr === '-') return '';
            try {
              const date = new Date(dateStr);
              return date.toISOString().split('T')[0];
            } catch {
              return '';
            }
          };

          setFormData({
            title: regulation.title || "",
            category: regulation.category || "",
            code: regulation.code || "",
            description: regulation.description || "",
            notes: regulation.notes || "",
            version: regulation.version || "v1.0",
            attachments: regulation.attachments || [],
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
      // Update the regulation via API
      await updateRegulation(id, formData);
      
      console.log("Regulation updated successfully:", formData);
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        router.push("/regulations");
      }, 1500);
    } catch (err) {
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
            <span className="font-semibold text-blue-600">{formData.code || 'N/A'}</span>
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
