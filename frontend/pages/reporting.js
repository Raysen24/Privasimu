// frontend/pages/reporting.js
import React, { useEffect, useMemo, useState } from "react";
import { useRegulationStore } from "../store/regulationStore";
import { useSearch } from "../contexts/SearchContext";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { formatDate, calculateRemainingTime, getRegulationDeadline, parseDate, isOverdue, isPublished } from "../lib/dateUtils";

export default function Reporting() {
  const { searchTerm } = useSearch();
  const regulations = useRegulationStore((state) => state.regulations);
  const loading = useRegulationStore((state) => state.loading);
  const error = useRegulationStore((state) => state.error);
  const fetchRegulations = useRegulationStore((state) => state.fetchRegulations);

  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [deadlineFilter, setDeadlineFilter] = useState("All");

  useEffect(() => {
    fetchRegulations().catch((err) => {
      console.error("Failed to fetch regulations for reporting:", err);
    });
  }, [fetchRegulations]);

  const categories = useMemo(
    () => Array.from(new Set(regulations.map((r) => r.category).filter(Boolean))),
    [regulations]
  );

  const filteredRegulations = useMemo(
    () =>
      regulations
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
          
          // Skip published regulations for deadline filtering
          if (isPublished(r.status)) return false;
          
          // Try multiple sources for the deadline
          const rawDeadline = r._original?.deadline || r.deadlineRaw || (typeof r.deadline !== 'string' ? r.deadline : null);
          const rawRevisionDeadline = r._original?.revisionDeadline || r.revisionDeadline;
          const deadline = getRegulationDeadline({
            ...r,
            deadline: rawDeadline,
            revisionDeadline: rawRevisionDeadline
          });
          
          if (!deadline) return false;

          const deadlineDate = parseDate(deadline);
          if (!deadlineDate) return false;

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const deadlineDateOnly = new Date(deadlineDate);
          deadlineDateOnly.setHours(0, 0, 0, 0);

          if (deadlineFilter === "Overdue") {
            return deadlineDateOnly < today;
          }

          const diffTime = deadlineDateOnly - today;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (deadlineFilter === "DueSoon") {
            return diffDays >= 0 && diffDays <= 7;
          }

          if (deadlineFilter === "Future") {
            return diffDays > 7;
          }

          return true;
        }),
    [regulations, searchTerm, statusFilter, categoryFilter, deadlineFilter]
  );

  const handleExportExcel = () => {
    const data = filteredRegulations.map((r) => {
      // Try multiple sources for the deadline
      const rawDeadline = r._original?.deadline || r.deadlineRaw || (typeof r.deadline !== 'string' ? r.deadline : null);
      const rawRevisionDeadline = r._original?.revisionDeadline || r.revisionDeadline;
      const deadline = getRegulationDeadline({
        ...r,
        deadline: rawDeadline,
        revisionDeadline: rawRevisionDeadline
      });
      
      return {
        Title: r.title,
        Reference: r.ref,
        Status: r.status,
        Category: r.category,
        Code: r.code,
        Deadline: isPublished(r.status) ? '—' : (deadline ? formatDate(deadline) : 'No deadline set'),
        Remaining: isPublished(r.status) ? '—' : (deadline ? calculateRemainingTime(deadline) : 'No deadline'),
        Version: r.version,
        Feedback: r.feedback,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Regulations");
    XLSX.writeFile(workbook, "regulations-report.xlsx");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF("l", "pt", "a4");
    const margin = 40;
    let y = margin;

    doc.setFontSize(16);
    doc.text("Regulations Report", margin, y);
    y += 20;

    doc.setFontSize(10);
    doc.text(
      `Generated: ${new Date().toLocaleString()} | Records: ${filteredRegulations.length}`,
      margin,
      y
    );
    y += 20;

    const headers = [
      "Title",
      "Reference",
      "Status",
      "Category",
      "Deadline",
      "Remaining",
    ];

    const colWidths = [150, 80, 80, 90, 80, 80];

    const drawRow = (cells, yPos, isHeader = false) => {
      let x = margin;
      cells.forEach((cell, index) => {
        doc.setFont(undefined, isHeader ? "bold" : "normal");
        doc.text(String(cell ?? ""), x, yPos, {
          maxWidth: colWidths[index] - 8,
        });
        x += colWidths[index];
      });
    };

    // Header row
    drawRow(headers, y, true);
    y += 16;

    filteredRegulations.forEach((r) => {
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
        drawRow(headers, y, true);
        y += 16;
      }

      // Try multiple sources for the deadline
      const rawDeadline = r._original?.deadline || r.deadlineRaw || (typeof r.deadline !== 'string' ? r.deadline : null);
      const rawRevisionDeadline = r._original?.revisionDeadline || r.revisionDeadline;
      const deadline = getRegulationDeadline({
        ...r,
        deadline: rawDeadline,
        revisionDeadline: rawRevisionDeadline
      });
      
      let deadlineStr = isPublished(r.status) ? '—' : 'No deadline';
      let remainingStr = isPublished(r.status) ? '—' : 'No deadline';
      
      if (!isPublished(r.status) && deadline) {
        const deadlineDate = parseDate(deadline);
        if (deadlineDate) {
          deadlineStr = formatDate(deadline);
          remainingStr = calculateRemainingTime(deadline);
        } else if (typeof deadline === 'string' && deadline !== '-' && deadline !== 'No deadline set') {
          deadlineStr = deadline;
        }
      }
      
      drawRow(
        [r.title, r.ref, r.status, r.category, deadlineStr, remainingStr],
        y
      );
      y += 14;
    });

    doc.save("regulations-report.pdf");
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Reporting</h1>
          <p className="text-sm text-gray-500 mt-1">
            Export filtered regulations to Excel or PDF.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Showing {filteredRegulations.length} of {regulations.length} regulations
            (respects global search + filters below).
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportExcel}
            disabled={filteredRegulations.length === 0}
            className="px-4 py-2 rounded-md text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export to Excel
          </button>
          <button
            onClick={handleExportPDF}
            disabled={filteredRegulations.length === 0}
            className="px-4 py-2 rounded-md text-sm font-medium bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export to PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error loading regulations: {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-4 items-center">
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

      <div className="overflow-x-auto bg-white rounded-lg shadow-sm border border-gray-200">
        <table className="min-w-full text-sm text-left text-gray-700">
          <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-semibold">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Deadline</th>
              <th className="px-4 py-3">Remaining</th>
              <th className="px-4 py-3">Version</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan="7"
                  className="px-4 py-6 text-center text-gray-500"
                >
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                    Loading regulations...
                  </div>
                </td>
              </tr>
            ) : filteredRegulations.length > 0 ? (
              filteredRegulations.map((r) => {
                // Try multiple sources for the deadline
                const rawDeadline = r._original?.deadline || r.deadlineRaw || (typeof r.deadline !== 'string' ? r.deadline : null);
                const rawRevisionDeadline = r._original?.revisionDeadline || r.revisionDeadline;
                const deadline = getRegulationDeadline({
                  ...r,
                  deadline: rawDeadline,
                  revisionDeadline: rawRevisionDeadline
                });
                
                let deadlineStr = isPublished(r.status) ? '—' : 'No deadline set';
                let remainingStr = isPublished(r.status) ? '—' : 'No deadline';
                let overdue = false;
                
                if (!isPublished(r.status) && deadline) {
                  const deadlineDate = parseDate(deadline);
                  if (deadlineDate) {
                    deadlineStr = formatDate(deadline);
                    remainingStr = calculateRemainingTime(deadline);
                    overdue = isOverdue(deadline);
                  } else if (typeof deadline === 'string' && deadline !== '-' && deadline !== 'No deadline set') {
                    deadlineStr = deadline;
                  }
                }
                
                return (
                  <tr
                    key={r.id}
                    className="border-b last:border-0 hover:bg-gray-50 transition"
                  >
                    <td className="px-4 py-3">{r.title}</td>
                    <td className="px-4 py-3">{r.ref}</td>
                    <td className="px-4 py-3">{r.status}</td>
                    <td className="px-4 py-3">{r.category}</td>
                    <td className={`px-4 py-3 ${overdue ? 'text-red-600 font-medium' : ''}`}>
                      {deadlineStr}
                      {r.status === 'Needs Revision' && rawRevisionDeadline && (
                        <span className="ml-2 text-xs text-red-600">(Revision)</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 ${overdue ? 'text-red-600 font-medium' : remainingStr.includes('Due today') ? 'text-orange-500 font-medium' : ''}`}>
                      {remainingStr}
                    </td>
                    <td className="px-4 py-3">{r.version}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan="7"
                  className="px-4 py-6 text-center text-gray-500 italic"
                >
                  No regulations found for the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


