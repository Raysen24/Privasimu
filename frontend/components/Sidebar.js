import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '../contexts/AuthContext'

export default function Sidebar() {
  const router = useRouter()
  const { logout, isReviewer, isAdmin } = useAuth()

  const isActive = (hrefPrefix) =>
    router.pathname === hrefPrefix || router.pathname.startsWith(hrefPrefix + '/')

  const admin = isAdmin()
  const reviewerOnly = isReviewer() && !admin

  const regulationsHref = reviewerOnly ? '/reviewer/regulations' : '/regulations'
  const regulationsActive = reviewerOnly ? isActive('/reviewer') : isActive('/regulations')

  const actionsNeededActive = isActive('/dashboard/actions-needed')
  const dashboardActive = isActive('/dashboard') && !actionsNeededActive

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const linkCls = (active) =>
    `flex items-center space-x-3 px-3 py-2 rounded-lg transition ${
      active ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
    }`

  return (
    <div className="w-64 bg-gray-100 min-h-screen p-4">
      <nav className="space-y-2">
        <Link href="/dashboard" className={linkCls(dashboardActive)}>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <span>Dashboard</span>
        </Link>

        {admin && (
          <Link href="/dashboard/actions-needed" className={linkCls(actionsNeededActive)}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Actions Needed</span>
          </Link>
        )}

        {!admin && (
          <>
            <Link href={regulationsHref} className={linkCls(regulationsActive)}>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span>Regulations</span>
            </Link>

            {!reviewerOnly && (
              <Link href="/reporting" className={linkCls(isActive('/reporting'))}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 17v-6a2 2 0 012-2h8m0 0l-3-3m3 3l-3 3"
                  />
                </svg>
                <span>Reporting</span>
              </Link>
            )}
          </>
        )}

        <div className="border-t border-gray-300 my-4" />

        <Link href="/settings" className={linkCls(isActive('/settings'))}>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span>Settings</span>
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center space-x-3 px-3 py-2 rounded-lg transition text-gray-700 hover:bg-gray-200 w-full text-left"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          <span>Log Out</span>
        </button>
      </nav>
    </div>
  )
}
