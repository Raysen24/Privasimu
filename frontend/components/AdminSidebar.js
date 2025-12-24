import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '../contexts/AuthContext'

export default function AdminSidebar() {
  const router = useRouter()
  const { logout } = useAuth()

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const isActive = (path) => router.pathname === path

  return (
    <aside className="sticky top-0 w-64 bg-white border-r border-gray-200 h-screen flex flex-col">
      <nav className="p-6 space-y-2 flex-1 overflow-y-auto">
        <Link href="/dashboard/admin" className={`block px-4 py-2 rounded-lg ${isActive('/dashboard/admin') ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}>
          Dashboard
        </Link>
        <Link href="/dashboard/actions-needed" className={`block px-4 py-2 rounded-lg ${isActive('/dashboard/actions-needed') ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}>
          Actions Needed
        </Link>
      </nav>

      <div className="border-t border-gray-200 p-6 space-y-2">
        <Link href="/settings" className={`block px-4 py-2 rounded-lg ${isActive('/settings') ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'}`}>
          Settings
        </Link>
        <button onClick={handleLogout} className="w-full text-left px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50">
          Logout
        </button>
      </div>
    </aside>
  )
}