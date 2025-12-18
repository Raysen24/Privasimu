import React from 'react';
import { useRouter } from 'next/router';
import { useRegulationStore } from '../store/regulationStore';

export default function RegulationsTable() {
  const regulations = useRegulationStore((state) => state.regulations)
  const submitRegulation = useRegulationStore((state) => state.submitRegulation)
  const resendRegulation = useRegulationStore((state) => state.resendRegulation)
  const router = useRouter()

  const handleEdit = (regulationId) => {
    router.push(`/edit-regulation?id=${regulationId}`);
  };

  const handleSubmit = (regulationId, regulationTitle) => {
    if (window.confirm(`Are you sure you want to submit "${regulationTitle}" for review?`)) {
      submitRegulation(regulationId);
    }
  };

  const handleResend = (regulationId, regulationTitle) => {
    if (window.confirm(`Are you sure you want to resend "${regulationTitle}" for review?`)) {
      resendRegulation(regulationId);
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
          <span className="text-gray-500 text-sm">
            Under Review
          </span>
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
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
        <h2 className="text-xl font-semibold text-gray-800">Regulations</h2>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => router.push('/add-regulation')}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition"
          >
            Add Regulation
          </button>
          <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-200 transition">
      <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden">
        <thead className="bg-gray-100 text-gray-600">
          <tr>
            <th className="py-2 px-3 text-left">Regulation Title</th>
            <th className="py-2 px-3 text-left">Regulation Code</th>
            <th className="py-2 px-3 text-left">Status</th>
            <th className="py-2 px-3 text-left">Deadline</th>
            <th className="py-2 px-3 text-left">Remaining Time</th>
            <th className="py-2 px-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {regulations.length === 0 ? (
            <tr>
              <td colSpan="6" className="text-center py-4 text-gray-500">
                No regulations found.
              </td>
            </tr>
          ) : (
            regulations.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50 transition">
                <td className="py-3 px-3">{r.title}</td>
                <td className="px-3">{getRegulationCode(r)}</td>
                <td className="px-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      r.status === 'Draft'
                        ? 'bg-yellow-100 text-yellow-800'
                        : r.status === 'Needs Revision'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-3">{r.deadline || '-'}</td>
                <td className="px-3">{r.remaining || '-'}</td>
                <td className="px-3">
                  {getActionButtons(r)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
