// frontend/pages/regulations.js
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useRegulationStore } from "../store/regulationStore";
import { useSearch } from "../contexts/SearchContext";
import { formatDate, calculateRemainingTime, getRegulationDeadline, parseDate, isOverdue, isPublished } from "../lib/dateUtils";

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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;


  const categories = Array.from(
    new Set(regulations.map((r) => r.category).filter(Boolean))
  );

  // Fetch regulations on mount and when query params change (for refresh)
  useEffect(() => {
    fetchRegulations().catch((err) => {
      console.error("Failed to fetch regulations:", err);
    });
  }, [fetchRegulations, router.query.refresh]);

  // Re-fetch regulations when navigating back to this page
  useEffect(() => {
    const handleRouteChange = () => {
      // Re-fetch when component becomes visible (user navigated back)
      if (router.pathname === '/regulations') {
        fetchRegulations().catch((err) => {
          console.error("Failed to fetch regulations:", err);
        });
      }
    };
    
    // Re-fetch when window gets focus (user switched back to tab)
    const handleFocus = () => {
      fetchRegulations().catch((err) => {
        console.error("Failed to fetch regulations:", err);
      });
    };
    
    window.addEventListener('focus', handleFocus);
    
    // Check if we're returning from another page
    if (document.visibilityState === 'visible') {
      // Small delay to ensure we're on the regulations page
      const timer = setTimeout(() => {
        if (router.pathname === '/regulations') {
          fetchRegulations().catch((err) => {
            console.error("Failed to fetch regulations:", err);
          });
        }
      }, 100);
      
      return () => {
        clearTimeout(timer);
        window.removeEventListener('focus', handleFocus);
      };
    }
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [router.pathname, fetchRegulations]);

  // Debug: Log all unique statuses when regulations change
  useEffect(() => {
    if (regulations.length > 0) {
      const uniqueStatuses = [...new Set(regulations.map(r => r.status))];
      console.log('All unique statuses in regulations:', uniqueStatuses);
      console.log('Total regulations:', regulations.length);
      if (statusFilter === "Pending Publish") {
        console.log('Regulations with status containing "pending" or "publish":', 
          regulations.filter(r => {
            const status = String(r.status || '').toLowerCase();
            return status.includes('pending') || status.includes('publish');
          }).map(r => ({ id: r.id, title: r.title, status: r.status }))
        );
      }
    }
  }, [regulations, statusFilter]);

  // Debug: Log deadline information when deadline filter changes
  useEffect(() => {
    if (deadlineFilter !== "All" && regulations.length > 0) {
      console.log(`Deadline filter active: ${deadlineFilter}`);
      console.log('Regulations with deadlines:', 
        regulations
          .filter(r => !isPublished(r.status))
          .map(r => {
            const rawDeadline = r._original?.deadline || r.deadlineRaw || (typeof r.deadline !== 'string' ? r.deadline : null);
            const rawRevisionDeadline = r._original?.revisionDeadline || r.revisionDeadline;
            let deadline = null;
            if (r.status === 'Needs Revision' && rawRevisionDeadline) {
              deadline = rawRevisionDeadline;
            } else if (rawDeadline) {
              deadline = rawDeadline;
            }
            const deadlineDate = parseDate(deadline);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const diffDays = deadlineDate ? Math.ceil((new Date(deadlineDate).setHours(0, 0, 0, 0) - today) / (1000 * 60 * 60 * 24)) : null;
            
            return {
              id: r.id,
              title: r.title,
              status: r.status,
              hasDeadline: !!deadline,
              deadlineDate: deadlineDate ? formatDate(deadlineDate) : 'No deadline',
              diffDays: diffDays,
              isOverdue: diffDays !== null && diffDays < 0,
              dueSoon: diffDays !== null && diffDays >= 0 && diffDays <= 7,
              future: diffDays !== null && diffDays > 7
            };
          })
      );
    }
  }, [deadlineFilter, regulations]);

  // ✅ Filter the list based on the search term
  const filteredRegulations = regulations
    .filter((r) =>
      Object.values(r).some((value) =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
    .filter((r) => {
      if (statusFilter === "All") return true;
      
      const regulationStatus = String(r.status || '').trim();
      const filterStatus = statusFilter.trim();
      
      // Exact match (case-insensitive)
      if (regulationStatus.toLowerCase() === filterStatus.toLowerCase()) {
        return true;
      }
      
      // Normalize both for fuzzy matching
      const normalize = (s) => String(s || '').toLowerCase().replace(/[_\-\s]+/g, '');
      const normalizedFilter = normalize(filterStatus);
      const normalizedRegulation = normalize(regulationStatus);
      
      // Exact match after normalization
      if (normalizedFilter === normalizedRegulation) {
        return true;
      }
      
      // For "Pending Publish" - check if status contains both "pending" and "publish"
      if (normalizedFilter.includes('pending') && normalizedFilter.includes('publish')) {
        const hasPending = normalizedRegulation.includes('pending') || normalizedRegulation.includes('pend');
        const hasPublish = normalizedRegulation.includes('publish') || normalizedRegulation.includes('pub');
        if (hasPending && hasPublish) {
          return true;
        }
      }
      
      // For "Pending Review" - check if status contains both "pending" and "review"
      if (normalizedFilter.includes('pending') && normalizedFilter.includes('review')) {
        const hasPending = normalizedRegulation.includes('pending') || normalizedRegulation.includes('pend');
        const hasReview = normalizedRegulation.includes('review') || normalizedRegulation.includes('rev');
        if (hasPending && hasReview) {
          return true;
        }
      }
      
      // For "Needs Revision" - check if status contains "needs" or "revision"
      if (normalizedFilter.includes('needs') || normalizedFilter.includes('revision')) {
        const hasNeeds = normalizedRegulation.includes('needs') || normalizedRegulation.includes('need');
        const hasRevision = normalizedRegulation.includes('revision') || normalizedRegulation.includes('revis');
        if (hasNeeds || hasRevision) {
          return true;
        }
      }
      
      // For "Draft" - exact match only
      if (normalizedFilter === 'draft' && normalizedRegulation === 'draft') {
        return true;
      }
      
      // For "Published" - check if status contains "publish"
      if (normalizedFilter.includes('published') || normalizedFilter.includes('publish')) {
        if (normalizedRegulation.includes('publish') || normalizedRegulation.includes('pub')) {
          // But exclude "pending publish"
          if (!normalizedRegulation.includes('pending') && !normalizedRegulation.includes('pend')) {
            return true;
          }
        }
      }
      
      return false;
    })
    .filter((r) =>
      categoryFilter === "All" ? true : r.category === categoryFilter
    )
    .filter((r) => {
      if (deadlineFilter === "All") return true;
      
      // Skip published regulations for deadline filtering
      if (isPublished(r.status)) return false;
      
      // Try multiple sources for the deadline
      const rawDeadline = r._original?.deadline || r.deadlineRaw || (typeof r.deadline !== 'string' ? r.deadline : null);
      const rawRevisionDeadline = r._original?.revisionDeadline || r.revisionDeadline;
      
      // Get the appropriate deadline (revision deadline for "Needs Revision", otherwise regular deadline)
      let deadline = null;
      if (r.status === 'Needs Revision' && rawRevisionDeadline) {
        deadline = rawRevisionDeadline;
      } else if (rawDeadline) {
        deadline = rawDeadline;
      }
      
      if (!deadline) {
        // Debug: log when deadline is missing
        if (deadlineFilter !== "All") {
          console.log('No deadline found for regulation:', {
            id: r.id,
            title: r.title,
            status: r.status,
            deadline: r.deadline,
            deadlineRaw: r.deadlineRaw,
            revisionDeadline: r.revisionDeadline,
            _original: r._original
          });
        }
        return false;
      }

      const deadlineDate = parseDate(deadline);
      if (!deadlineDate) {
        // Debug: log when deadline can't be parsed
        if (deadlineFilter !== "All") {
          console.log('Could not parse deadline:', {
            id: r.id,
            title: r.title,
            deadline: deadline,
            deadlineType: typeof deadline
          });
        }
        return false;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deadlineDateOnly = new Date(deadlineDate);
      deadlineDateOnly.setHours(0, 0, 0, 0);

      const diffTime = deadlineDateOnly - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let matches = false;

      if (deadlineFilter === "Overdue") {
        matches = diffDays < 0;
      } else if (deadlineFilter === "DueSoon") {
        matches = diffDays >= 0 && diffDays <= 7;
      } else if (deadlineFilter === "Future") {
        matches = diffDays > 7;
      }

      // Debug: log filtering results
      if (deadlineFilter !== "All" && matches) {
        console.log('Deadline filter match:', {
          filter: deadlineFilter,
          regulationId: r.id,
          title: r.title,
          deadline: formatDate(deadline),
          diffDays: diffDays,
          isOverdue: diffDays < 0
        });
      }

      return matches;
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
  // Pagination (client-side)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, categoryFilter, deadlineFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRegulations.length / itemsPerPage));
  const paginatedRegulations = filteredRegulations.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );



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
                  <option value="Pending Review">Pending Review</option>
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
                <th className="px-6 py-3">Feedback</th>
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
                paginatedRegulations.map((r, index) => (
                  <tr
                    key={index}
                    className="border-b last:border-0 hover:bg-gray-50 transition"
                  >
                    <td className="px-6 py-3 font-medium">{r.title}</td>
                    <td className="px-6 py-3 text-gray-600">{r.ref}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        r.status === "Needs Revision"
                          ? "bg-red-100 text-red-800"
                          : r.status === "Pending Publish"
                          ? "bg-yellow-100 text-yellow-800"
                          : r.status === "Published"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {r.status || 'Draft'}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col">
                        {isPublished(r.status) ? (
                          <span className="text-gray-400 text-sm">—</span>
                        ) : (() => {
                          // Try multiple sources for the deadline
                          const rawDeadline = r._original?.deadline || r.deadlineRaw || (typeof r.deadline !== 'string' ? r.deadline : null);
                          const rawRevisionDeadline = r._original?.revisionDeadline || r.revisionDeadline;
                          
                          // Get the appropriate deadline
                          const deadline = getRegulationDeadline({
                            ...r,
                            deadline: rawDeadline,
                            revisionDeadline: rawRevisionDeadline
                          });
                          
                          if (!deadline) {
                            return <span className="text-gray-500">No deadline set</span>;
                          }
                          
                          const deadlineDate = parseDate(deadline);
                          if (!deadlineDate) {
                            // If we can't parse it, it might be a formatted string - try to show it
                            if (typeof deadline === 'string' && deadline !== '-' && deadline !== 'No deadline set') {
                              return <span className="text-gray-900">{deadline}</span>;
                            }
                            return <span className="text-gray-500">No deadline set</span>;
                          }
                          
                          const overdue = isOverdue(deadline);
                          
                          return (
                            <>
                              <span className={`font-medium ${overdue ? 'text-red-600' : 'text-gray-900'}`}>
                                {formatDate(deadline)}
                                {r.status === 'Needs Revision' && rawRevisionDeadline && (
                                  <span className="ml-2 text-xs text-red-600">(Revision)</span>
                                )}
                              </span>
                              <span className={`text-xs mt-1 ${overdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                                {calculateRemainingTime(deadline)}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col">
                        {isPublished(r.status) ? (
                          <span className="text-gray-400 text-sm">—</span>
                        ) : (() => {
                          // Try multiple sources for the deadline
                          const rawDeadline = r._original?.deadline || r.deadlineRaw || (typeof r.deadline !== 'string' ? r.deadline : null);
                          const rawRevisionDeadline = r._original?.revisionDeadline || r.revisionDeadline;
                          const deadline = getRegulationDeadline({
                            ...r,
                            deadline: rawDeadline,
                            revisionDeadline: rawRevisionDeadline
                          });
                          
                          if (!deadline) {
                            return <span className="text-gray-400 text-sm">—</span>;
                          }
                          
                          const deadlineDate = parseDate(deadline);
                          if (!deadlineDate) {
                            return <span className="text-gray-400 text-sm">—</span>;
                          }
                          
                          const remaining = calculateRemainingTime(deadline);
                          const overdue = isOverdue(deadline);
                          
                          return (
                            <span className={`text-sm ${overdue ? 'text-red-600 font-medium' : remaining.includes('Due today') ? 'text-orange-500 font-medium' : 'text-gray-600'}`}>
                              {remaining}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">{r.feedback || '-'}</td>
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
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className={`border border-gray-300 px-4 py-1.5 rounded-md hover:bg-gray-100 ${
              currentPage <= 1 ? "opacity-50 cursor-not-allowed hover:bg-transparent" : ""
            }`}
          >
            Previous
          </button>

          <p>
            Page {currentPage} of {totalPages} • {filteredRegulations.length} total
          </p>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className={`border border-gray-300 px-4 py-1.5 rounded-md hover:bg-gray-100 ${
              currentPage >= totalPages ? "opacity-50 cursor-not-allowed hover:bg-transparent" : ""
            }`}
          >
            Next
          </button>
        </div>
</div>
    </div>
  );
}