// frontend/pages/regulations.js
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useRegulationStore } from "../store/regulationStore";
import { useSearch } from "../contexts/SearchContext";

export default function Regulations() {
  const router = useRouter();
  const { searchTerm } = useSearch();
  const regulations = useRegulationStore((state) => state.regulations);
  const loading = useRegulationStore((state) => state.loading);
  const error = useRegulationStore((state) => state.error);
  const fetchRegulations = useRegulationStore((state) => state.fetchRegulations);
  const deleteRegulation = useRegulationStore((state) => state.deleteRegulation);
  const submitRegulation = useRegulationStore((state) => state.submitRegulation);
  const resendRegulation = useRegulationStore((state) => state.resendRegulation);

  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [deadlineFilter, setDeadlineFilter] = useState("All");

  const categories = Array.from(
    new Set(regulations.map((r) => r.category).filter(Boolean))
  );

  // Fetch regulations on mount
  useEffect(() => {
    fetchRegulations().catch((err) => {
      console.error("Failed to fetch regulations:", err);
    });
  }, [fetchRegulations]);

  // ✅ Filter the list based on the search term
  const filteredRegulations = regulations
    .filter((r) =>
      Object.values(r).some((value) =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
    .filter((r) => (statusFilter === "All" ? true : r.status === statusFilter))
    .filter((r) =>
      categoryFilter === "All" ? true : r.category === categoryFilter
    )
    .filter((r) => {
      if (deadlineFilter === "All") return true;
      if (!r.deadline) return false;

      const today = new Date();
      const deadline = new Date(r.deadline);

      if (deadlineFilter === "Overdue") {
        return deadline < today;
      }

      const diffTime = deadline - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (deadlineFilter === "DueSoon") {
        return diffDays >= 0 && diffDays <= 7;
      }

      if (deadlineFilter === "Future") {
        return diffDays > 7;
      }

      return true;
    });

  const handleEdit = (regulationId) => {
    router.push(`/edit-regulation?id=${regulationId}`);
  };

  const handleDelete = async (regulationId, regulationTitle) => {
    if (window.confirm(`Are you sure you want to delete "${regulationTitle}"?`)) {
      try {
        await deleteRegulation(regulationId);
        // Refresh the list
        await fetchRegulations();
      } catch (err) {
        alert(`Failed to delete regulation: ${err.message}`);
      }
    }
  };

  const handleSubmit = async (regulationId, regulationTitle) => {
    if (window.confirm(`Are you sure you want to submit "${regulationTitle}" for review?`)) {
      try {
        await submitRegulation(regulationId);
        // Refresh the list
        await fetchRegulations();
      } catch (err) {
        alert(`Failed to submit regulation: ${err.message}`);
      }
    }
  };

  const handleResend = async (regulationId, regulationTitle) => {
    if (window.confirm(`Are you sure you want to resend "${regulationTitle}" for review?`)) {
      try {
        await resendRegulation(regulationId);
        // Refresh the list
        await fetchRegulations();
      } catch (err) {
        alert(`Failed to resend regulation: ${err.message}`);
      }
    }
  };

  const handleView = (regulationId) => {
    router.push(`/view-regulation?id=${regulationId}`);
  };

  const getActionButtons = (regulation) => {
    switch (regulation.status) {
      case "Draft":
        return (
          <div className="flex gap-2">
            <button
              onClick={() => handleEdit(regulation.id)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium hover:underline"
            >
              Edit
            </button>
            <span className="text-gray-300">·</span>
            <button
              onClick={() => handleSubmit(regulation.id, regulation.title)}
              className="text-green-600 hover:text-green-800 text-sm font-medium hover:underline"
            >
              Submit
            </button>
          </div>
        );
      case "Needs Revision":
        return (
          <div className="flex gap-2">
            <button
              onClick={() => handleEdit(regulation.id)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium hover:underline"
            >
              Edit
            </button>
            <span className="text-gray-300">·</span>
            <button
              onClick={() => handleResend(regulation.id, regulation.title)}
              className="text-orange-600 hover:text-orange-800 text-sm font-medium hover:underline"
            >
              Resend
            </button>
          </div>
        );
      case "Published":
        return (
          <button
            onClick={() => handleView(regulation.id)}
            className="text-green-600 hover:text-green-800 text-sm font-medium hover:underline"
          >
            View
          </button>
        );
      case "Pending Review":
      case "Pending Publish":
        return (
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span className="text-gray-500 text-sm">Pending Review</span>
            <button
              onClick={() => handleView(regulation.id)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium hover:underline"
            >
              View
            </button>
          </div>
        );
      default:
        return (
          <button
            onClick={() => handleView(regulation.id)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium hover:underline"
          >
            View
          </button>
        );
    }
  };

  return (
    <div className="p-6">
        {/* Top Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Regulations</h2>
            <p className="text-sm text-gray-500 mt-1">
              Showing {filteredRegulations.length} of {regulations.length} regulations
            </p>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              Error: {error}
            </div>
          )}
          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={() => router.push("/add-regulation")}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
            >
              Add Regulation
            </button>
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All">All</option>
                  <option value="Draft">Draft</option>
                  <option value="Needs Revision">Needs Revision</option>
                  <option value="Pending Publish">Pending Publish</option>
                  <option value="Published">Published</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All">All</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Deadline:</span>
                <select
                  value={deadlineFilter}
                  onChange={(e) => setDeadlineFilter(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All">All</option>
                  <option value="Overdue">Overdue</option>
                  <option value="DueSoon">Due in 7 days</option>
                  <option value="Future">More than 7 days</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto bg-white shadow-sm rounded-lg border border-gray-200">
          <table className="min-w-full text-sm text-left text-gray-700">
            <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-3">Regulation Title</th>
                <th className="px-6 py-3">Reference no</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Deadline</th>
                <th className="px-6 py-3">Remaining Time</th>
                <th className="px-6 py-3">Reviewer Feedback</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-6 text-center text-gray-500">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                      Loading regulations...
                    </div>
                  </td>
                </tr>
              ) : filteredRegulations.length > 0 ? (
                filteredRegulations.map((r, index) => (
                  <tr
                    key={index}
                    className="border-b last:border-0 hover:bg-gray-50 transition"
                  >
                    <td className="px-6 py-3">{r.title}</td>
                    <td className="px-6 py-3">{r.ref}</td>
                    <td
                      className={`px-6 py-3 font-medium ${
                        r.status === "Needs Revision"
                          ? "text-red-600"
                          : r.status === "Pending Publish"
                          ? "text-yellow-600"
                          : r.status === "Published"
                          ? "text-green-600"
                          : "text-gray-700"
                      }`}
                    >
                      {r.status}
                    </td>
                    <td className="px-6 py-3">{r.deadline}</td>
                    <td
                      className={`px-6 py-3 ${
                        r.remaining.includes("hour") ||
                        r.remaining === "Overdue"
                          ? "text-red-600"
                          : r.remaining.includes("day")
                          ? "text-orange-500"
                          : "text-gray-700"
                      }`}
                    >
                      {r.remaining}
                    </td>
                    <td className="px-6 py-3">{r.feedback}</td>
                    <td className="px-6 py-3">
                      {getActionButtons(r)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="7"
                    className="px-6 py-6 text-center text-gray-500 italic"
                  >
                    {error ? "Error loading regulations" : "No regulations found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center mt-6 text-sm text-gray-600">
          <button className="border border-gray-300 px-4 py-1.5 rounded-md hover:bg-gray-100">
            Previous
          </button>
          <p>Page 1 of 10</p>
          <button className="border border-gray-300 px-4 py-1.5 rounded-md hover:bg-gray-100">
            Next
          </button>
        </div>
    </div>
  );
}
