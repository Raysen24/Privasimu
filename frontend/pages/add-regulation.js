"use client";

import { useRegulationStore } from "../store/regulationStore";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../contexts/AuthContext";

// Dynamically import ReactQuill (for client-side only)
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });
import "react-quill/dist/quill.snow.css";

export default function AddRegulation() {
  const router = useRouter();
  const { user } = useAuth();
  const formData = useRegulationStore((state) => state.formData);
  const setField = useRegulationStore((state) => state.setField);
  const resetForm = useRegulationStore((state) => state.resetForm);
  const addRegulation = useRegulationStore((state) => state.addRegulation);
  const submitRegulation = useRegulationStore((state) => state.submitRegulation);
  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [attachmentLabel, setAttachmentLabel] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [refNumberPreview, setRefNumberPreview] = useState("");
  const attachments = Array.isArray(formData.attachments) ? formData.attachments : [];

  // Generate a preview reference number based on category
  useEffect(() => {
    // Default to a random letter if no category is selected
    let prefix = 'X';
    
    // Map category to first letter
    if (formData.category) {
      prefix = formData.category.charAt(0).toUpperCase();
    }
    
    const randomNumber = Math.floor(1000 + Math.random() * 9000);
    setRefNumberPreview(`${prefix}${randomNumber}`);
  }, [formData.category]); // Regenerate when category changes

  const handleAddAttachmentLink = () => {
    if (!attachmentLabel.trim() || !attachmentUrl.trim()) {
      alert("Please provide both a label and URL for the attachment.");
      return;
    }

    try {
      const url = new URL(attachmentUrl.trim());
      const next = [
        ...attachments,
        {
          name: attachmentLabel.trim(),
          url: url.toString(),
        },
      ];
      useRegulationStore.getState().setField("attachments", next);
      setAttachmentLabel("");
      setAttachmentUrl("");
    } catch (error) {
      alert("Please enter a valid URL (e.g., https://example.com/document.pdf).");
    }
  };

  const handleRemoveAttachment = (index) => {
    const next = attachments.filter((_, i) => i !== index);
    useRegulationStore.getState().setField("attachments", next);
  };

  const handleSaveAsDraft = async (e) => {
    e.preventDefault();
    
    // Prevent multiple submissions
    if (isSaved) {
      return;
    }
    
    // Validate required fields
    if (!formData.title || !formData.category) {
      alert("Please fill in all required fields (Title and Category)");
      return;
    }
    
    try {
      // Set saving state
      setIsSaved(true);
      
      // Add the regulation with explicit Draft status and createdBy
      await addRegulation({
        ...formData,
        status: 'Draft', // Explicitly set status to Draft
        createdBy: user.uid, // Add createdBy field
        updatedAt: new Date() // Ensure updatedAt is set
      });
      
      console.log("Regulation saved as draft:", formData);
      
      // Reset the form after successful save
      resetForm();
      
      // Navigate to regulations list after a short delay
      setTimeout(() => {
        router.push("/regulations");
      }, 1000);
      
    } catch (error) {
      console.error('Save as draft error:', error);
      alert(`Failed to save draft: ${error.message}`);
      setIsSaved(false); // Reset saving state on error
    }
  };

const handleSubmitForReview = async (e) => {
  e.preventDefault();
  
  // Prevent multiple submissions
  if (isSubmitted) {
    return;
  }
  
  // Validate required fields
  if (!formData.title || !formData.category) {
    alert("Please fill in all required fields (Title and Category are required)");
    return;
  }
  
  try {
    // Set submitting state
    setIsSubmitted(true);
    
    // First, save the regulation as a draft
    const newRegulation = {
      ...formData,
      status: 'Draft', // Explicitly set status to Draft
      createdBy: user.uid,
      updatedAt: new Date().toISOString()
    };
    
    console.log('Saving regulation as draft:', newRegulation);
    
    // Add the regulation and wait for it to be fully saved
    const savedRegulation = await addRegulation(newRegulation);
    
    if (!savedRegulation || !savedRegulation.id) {
      throw new Error('Failed to save regulation as draft');
    }
    
    console.log('Regulation saved as draft, now submitting for review:', savedRegulation.id);
    
    // Add a small delay to ensure the regulation is fully saved and propagated
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Then submit it for review
    const submittedRegulation = await submitRegulation(savedRegulation.id);
    
    if (!submittedRegulation) {
      throw new Error('Failed to submit regulation for review');
    }
    
    console.log("Regulation submitted for review:", submittedRegulation);
    
    // Reset the form after successful submission
    resetForm();
    
    // Navigate to regulations list after a short delay
    setTimeout(() => {
      router.push("/regulations");
    }, 1000);
    
  } catch (error) {
    console.error('Submission error:', error);
    alert(`Failed to submit regulation: ${error.message}`);
    setIsSubmitted(false); // Reset submission state on error
  }
};

  const handleDiscard = () => {
    if (window.confirm("Are you sure you want to discard all changes?")) {
      resetForm();
      router.push("/regulations");
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Create New Regulation</h1>

        <form className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title:</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="Enter Regulation Title"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category:</label>
                <select
                  value={formData.category}
                  onChange={(e) => setField("category", e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

              {/* Reference Number Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reference Number:</label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono">
                  <span className="font-semibold text-blue-600">{refNumberPreview}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">Preview of your reference number</p>
              </div>

              {/* Attachments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Attachments:</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <p className="text-sm text-gray-600">
                    Paste external links (Google Drive, SharePoint, etc.) and give them a short label.
                  </p>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Attachment name (e.g., Risk Matrix)"
                      value={attachmentLabel}
                      onChange={(e) => setAttachmentLabel(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="url"
                      placeholder="https://..."
                      value={attachmentUrl}
                      onChange={(e) => setAttachmentUrl(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={handleAddAttachmentLink}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                    >
                      Add Attachment Link
                    </button>
                  </div>
                  {attachments.length > 0 && (
                    <div className="mt-4 text-left">
                      <p className="text-xs font-semibold text-gray-600 mb-1">
                        Attached links:
                      </p>
                      <ul className="space-y-1 max-h-32 overflow-y-auto text-xs text-gray-700">
                        {attachments.map((file, index) => (
                          <li key={`${file.url}-${index}`} className="flex items-center justify-between gap-2">
                            <span className="truncate max-w-xs" title={file.name}>
                              {file.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                View
                              </a>
                              <button
                                type="button"
                                onClick={() => handleRemoveAttachment(index)}
                                className="text-red-600 hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>


              {/* Version */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Version:</label>
                <input
                  type="text"
                  value={formData.version}
                  onChange={(e) => setField("version", e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description:</label>
                <div className="border border-gray-300 rounded-lg">
                  <ReactQuill
                    theme="snow"
                    value={formData.description}
                    onChange={(value) => setField("description", value)}
                    placeholder="Short Summary Here..."
                    className="bg-white"
                    modules={{
                      toolbar: [
                        ['code-block'],
                        ['bold', 'italic', 'underline'],
                        [{'list': 'ordered'}, {'list': 'bullet'}],
                        ['link', 'image'],
                        ['clean']
                      ]
                    }}
                  />
                </div>
              </div>

              {/* Authors Note to Reviewer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Authors Note to Reviewer:</label>
                <textarea
                  rows={6}
                  value={formData.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  placeholder="Enter Important Notes..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 pt-6">
            <button
              type="button"
              onClick={handleDiscard}
              className="px-6 py-3 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSaveAsDraft}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              Save as Draft
            </button>
            <button
              type="button"
              onClick={handleSubmitForReview}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              Submit For Review
            </button>
          </div>

          {/* Status Messages */}
          {isSaved && (
            <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg">
              ✅ Regulation saved as draft successfully!
            </div>
          )}
          {isSubmitted && (
            <div className="fixed top-4 right-4 bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded-lg shadow-lg">
              ✅ Regulation submitted for review successfully!
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
