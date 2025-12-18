import '../styles/globals.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import Layout from '../components/Layout'
import { SearchProvider } from '../contexts/SearchContext'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { useRouter } from 'next/router'

function AppContent({ Component, pageProps }) {
  const { isLoggedIn, isLoading } = useAuth()
  const router = useRouter()

  // Show loading spinner while checking auth status
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated and not on login page
  if (!isLoggedIn && router.pathname !== '/login') {
    router.push('/login')
    return null
  }

  // Redirect to dashboard if authenticated and on login page
  if (isLoggedIn && router.pathname === '/login') {
    router.push('/dashboard')
    return null
  }

  // Show login page without layout
  if (router.pathname === '/login') {
    return <Component {...pageProps} />
  }

  // Show other pages with layout
  return (
    <SearchProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </SearchProvider>
  )
}

export default function MyApp({ Component, pageProps }) {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent Component={Component} pageProps={pageProps} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
