/**
 * Regulation PDF generator (client-side)
 *
 * Generates a readable PDF that includes the main regulation fields plus
 * history/notes/feedback when available.
 */

import jsPDF from "jspdf";
import api from "./api";

const safe = (v) => {
  if (v === null || v === undefined) return "-";
  if (typeof v === "string") return v.trim() ? v : "-";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return String(v);
};

const toDateString = (value) => {
  if (!value) return "-";
  try {
    // Firestore Timestamp
    if (value?.toDate) return value.toDate().toLocaleString();
    // Firestore {_seconds}
    if (value?._seconds) return new Date(value._seconds * 1000).toLocaleString();
    // ISO string / Date
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return safe(value);
    return d.toLocaleString();
  } catch {
    return safe(value);
  }
};

const normalizeHistory = (history) => {
  if (!Array.isArray(history)) return [];
  return history
    .map((h) => ({
      action: safe(h.action),
      by: safe(h.by || h.user || h.userEmail || h.userId),
      comment: safe(h.comment),
      at: toDateString(h.timestamp || h.at || h.date),
    }))
    .slice(0, 25); // keep it readable
};

const addWrapped = (doc, text, x, y, maxWidth, lineHeight) => {
  const lines = doc.splitTextToSize(String(text), maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
};

const addSectionTitle = (doc, title, x, y) => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, x, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  return y + 6;
};

/**
 * Download regulation as a PDF.
 *
 * @param {string} regulationId
 * @param {object} [fallbackRegulation] - optional, used if API fetch fails
 */
export async function downloadRegulationPdf(regulationId, fallbackRegulation) {
  let regulation = fallbackRegulation;
  try {
    const res = await api.regulations.getById(regulationId);
    regulation = res?.data || regulation;
  } catch {
    // If the API is down, we still try to generate a PDF from whatever we have.
  }

  if (!regulation) throw new Error("Regulation data not available");

  const original = regulation._original || {};
  const history = normalizeHistory(original.history);
  const attachments = Array.isArray(regulation.attachments) ? regulation.attachments : [];

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 14;

  let y = margin;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  y = addWrapped(doc, safe(regulation.title || "Regulation"), margin, y, maxWidth, 18);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
  y += 18;

  const ensurePage = () => {
    if (y < pageHeight - margin) return;
    doc.addPage();
    y = margin;
  };

  // Metadata
  y = addSectionTitle(doc, "Metadata", margin, y);
  ensurePage();

  const meta = [
    ["Reference", safe(regulation.ref)],
    ["Status", safe(regulation.status)],
    ["Category", safe(regulation.category)],
    ["Code", safe(regulation.code)],
    ["Version", safe(regulation.version)],
    ["Deadline", safe(regulation.deadline)],
    ["Remaining", safe(regulation.remaining)],
    ["Submitted At", toDateString(regulation.submittedAt || original.submittedAt)],
    ["Reviewed At", toDateString(regulation.reviewedAt || original.reviewedAt)],
    ["Published At", toDateString(regulation.publishedAt || original.publishedAt)],
    ["Created At", toDateString(regulation.createdAt || original.createdAt)],
    ["Created By", safe(original.createdBy || original.createdByEmail || original.createdByName)],
    ["Assigned To", safe(original.assignedTo || original.assignedToEmail || original.assignedToName)],
    ["Reviewed By", safe(regulation.reviewerName || original.reviewerName || regulation.reviewedBy)],
  ];

  doc.setFontSize(10);
  meta.forEach(([k, v]) => {
    ensurePage();
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, margin, y);
    doc.setFont("helvetica", "normal");
    y = addWrapped(doc, v, margin + 110, y, maxWidth - 110, lineHeight);
    y += 2;
  });
  y += 8;

  // Description
  ensurePage();
  y = addSectionTitle(doc, "Description", margin, y);
  ensurePage();
  y = addWrapped(doc, safe(regulation.description || original.description), margin, y, maxWidth, lineHeight);
  y += 10;

  // Notes
  ensurePage();
  y = addSectionTitle(doc, "Notes", margin, y);
  ensurePage();
  y = addWrapped(doc, safe(regulation.notes || original.notes), margin, y, maxWidth, lineHeight);
  y += 10;

  // Feedback / Admin notes
  ensurePage();
  y = addSectionTitle(doc, "Review Feedback", margin, y);
  ensurePage();
  y = addWrapped(
    doc,
    safe(regulation.reviewerFeedback || regulation.feedback || original.feedback),
    margin,
    y,
    maxWidth,
    lineHeight
  );
  y += 10;

  ensurePage();
  y = addSectionTitle(doc, "Admin Notes", margin, y);
  ensurePage();
  y = addWrapped(doc, safe(regulation.adminNotes || original.adminNotes), margin, y, maxWidth, lineHeight);
  y += 10;

  // Attachments
  ensurePage();
  y = addSectionTitle(doc, "Attachments", margin, y);
  ensurePage();
  if (attachments.length === 0) {
    y = addWrapped(doc, "-", margin, y, maxWidth, lineHeight);
    y += 10;
  } else {
    attachments.forEach((a, idx) => {
      ensurePage();
      const name = safe(a?.name || `Attachment ${idx + 1}`);
      const url = safe(a?.url || "-");
      y = addWrapped(doc, `${idx + 1}. ${name}`, margin, y, maxWidth, lineHeight);
      y = addWrapped(doc, `   ${url}`, margin, y, maxWidth, lineHeight);
      y += 6;
    });
  }

  // History
  ensurePage();
  y = addSectionTitle(doc, "History", margin, y);
  ensurePage();
  if (history.length === 0) {
    y = addWrapped(doc, "-", margin, y, maxWidth, lineHeight);
  } else {
    history.forEach((h, idx) => {
      ensurePage();
      doc.setFont("helvetica", "bold");
      doc.text(`${idx + 1}. ${h.action}`, margin, y);
      doc.setFont("helvetica", "normal");
      y += lineHeight;
      y = addWrapped(doc, `By: ${h.by}`, margin + 14, y, maxWidth - 14, lineHeight);
      y = addWrapped(doc, `At: ${h.at}`, margin + 14, y, maxWidth - 14, lineHeight);
      if (h.comment && h.comment !== "-") {
        y = addWrapped(doc, `Comment: ${h.comment}`, margin + 14, y, maxWidth - 14, lineHeight);
      }
      y += 8;
    });
  }

  const filenameBase = (regulation.ref || regulation.title || "regulation")
    .toString()
    .replace(/[^a-z0-9\-_]+/gi, "_")
    .replace(/_+/g, "_")
    .slice(0, 64);

  doc.save(`${filenameBase}.pdf`);
}
