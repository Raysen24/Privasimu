import React from 'react'
import { useRouter } from 'next/router'
import { useRegulationStore } from '../store/regulationStore'

export default function RegulationsTable() {
  const router = useRouter()
  const regulations = useRegulationStore((state) => state.regulations)
  const submitRegulation = useRegulationStore((state) => state.submitRegulation)
  const resendRegulation = useRegulationStore((state) => state.resendRegulation)

  const handleEdit = (id) => router.push(`/edit-regulation?id=${id}`)
  const handleView = (id) => router.push(`/view-regulation?id=${id}`)

  const handleSubmit = (id, title) => {
    if (window.confirm(`Are you sure you want to submit "${title}" for review?`)) {
      submitRegulation(id)
    }
  }

  const handleResend = (id, title) => {
    if (window.confirm(`Are you sure you want to resend "${title}" for review?`)) {
      resendRegulation(id)
    }
  }

  const getRegulationCode = (r) => r.code || r.regulationCode || r.ref || r.refNumber || '-'

  const action = (r) => {
    switch (r.status) {
      case 'Draft':
        return (
          <div className="flex gap-2">
            <button onClick={() => handleEdit(r.id)} className="text-blue-600 hover:underline text-sm font-medium">Edit</button>
            <span className="text-gray-300">·</span>
            <button onClick={() => handleSubmit(r.id, r.title)} className="text-green-600 hover:underline text-sm font-medium">Submit</button>
          </div>
        )
      case 'Needs Revision':
        return (
          <div className="flex gap-2">
            <button onClick={() => handleEdit(r.id)} className="text-blue-600 hover:underline text-sm font-medium">Edit</button>
            <span className="text-gray-300">·</span>
            <button onClick={() => handleResend(r.id, r.title)} className="text-orange-600 hover:underline text-sm font-medium">Resend</button>
          </div>
        )
      case 'Published':
        return (
          <button onClick={() => handleView(r.id)} className="text-green-600 hover:underline text-sm font-medium">View</button>
        )
      case 'Pending Review':
      case 'Pending Publish':
        return <span className="text-gray-500 text-sm">In Progress</span>
      default:
        return (
          <button onClick={() => handleView(r.id)} className="text-blue-600 hover:underline text-sm font-medium">View</button>
        )
    }
  }

  const badge = (status) => {
    switch (status) {
      case 'Draft':
        return 'bg-gray-100 text-gray-800'
      case 'Pending Review':
        return 'bg-yellow-100 text-yellow-800'
      case 'Needs Revision':
        return 'bg-red-100 text-red-800'
      case 'Pending Publish':
        return 'bg-blue-100 text-blue-800'
      case 'Published':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
        <h2 className="text-xl font-semibold text-gray-800">Regulations</h2>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => router.push('/add-regulation')}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition"
          >
            Add Regulation
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="py-2 px-3 text-left">Title</th>
              <th className="py-2 px-3 text-left">Code</th>
              <th className="py-2 px-3 text-left">Status</th>
              <th className="py-2 px-3 text-left">Deadline</th>
              <th className="py-2 px-3 text-left">Remaining</th>
              <th className="py-2 px-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {regulations.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-6 text-gray-500">
                  No regulations found.
                </td>
              </tr>
            ) : (
              regulations.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition">
                  <td className="py-3 px-3">{r.title}</td>
                  <td className="px-3">{getRegulationCode(r)}</td>
                  <td className="px-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${badge(r.status)}`}>{r.status || '-'}</span>
                  </td>
                  <td className="px-3">{r.deadline || '-'}</td>
                  <td className="px-3">{r.remaining || '-'}</td>
                  <td className="px-3">{action(r)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
