import React from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function SettingsPage() {
  const { user } = useAuth()
  return (
    <div className="p-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-xl">
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Settings</h1>
        <div className="text-sm text-gray-700 space-y-2">
          <div><span className="font-medium">Name:</span> {user?.name || '-'}</div>
          <div><span className="font-medium">Email:</span> {user?.email || '-'}</div>
          <div><span className="font-medium">Role:</span> {user?.role || '-'}</div>
          <div><span className="font-medium">Department:</span> {user?.department || '-'}</div>
        </div>
        <p className="mt-6 text-xs text-gray-500">
          (This page is a placeholder. Add profile edits / password reset / notifications here.)
        </p>
      </div>
    </div>
  )
}
