import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.jsx'
import { ApiKeyProvider, useApiKey } from './byok/ApiKeyContext.jsx'
import { DataProvider } from './data/AppData.jsx'
import { AiActivityProvider } from './ai/AiActivity.jsx'
import SignInScreen from './components/SignInScreen.jsx'
import AppShell from './components/AppShell.jsx'
import ApiKeySetup from './pages/ApiKeySetup.jsx'

// Route pages are code-split so the initial load only ships the shell + gate.
const PositionsPage = lazy(() => import('./pages/PositionsPage.jsx'))
const PositionDetailPage = lazy(() => import('./pages/PositionDetailPage.jsx'))
const ResumesPage = lazy(() => import('./pages/ResumesPage.jsx'))
const ApplicationsPage = lazy(() => import('./pages/ApplicationsPage.jsx'))

export default function App() {
  const { ready, isAuthenticated } = useAuth()
  if (!ready) return <Splash />
  if (!isAuthenticated) return <SignInScreen />

  // Once signed in, BYOK is the mandatory first step until a key is linked.
  return (
    <ApiKeyProvider>
      <KeyGated />
    </ApiKeyProvider>
  )
}

function KeyGated() {
  const { loading, needsSetup } = useApiKey()
  if (loading) return <Splash />
  if (needsSetup) return <ApiKeySetup onboarding />

  return (
    <DataProvider>
      <AiActivityProvider>
        <AppShell>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/positions" replace />} />
              <Route path="/positions" element={<PositionsPage />} />
              <Route path="/positions/:id/*" element={<PositionDetailPage />} />
              <Route path="/resumes" element={<ResumesPage />} />
              <Route path="/applications" element={<ApplicationsPage />} />
              <Route path="/settings" element={<ApiKeySetup />} />
              <Route path="*" element={<Navigate to="/positions" replace />} />
            </Routes>
          </Suspense>
        </AppShell>
      </AiActivityProvider>
    </DataProvider>
  )
}

/** Inline spinner shown while a lazy page chunk loads. */
function PageFallback() {
  return (
    <div className="flex items-center justify-center gap-3 px-6 py-24 text-sm text-slate-400">
      <svg className="animate-spin text-accent" width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
        <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      Loading…
    </div>
  )
}

function Splash() {
  return (
    <div className="grid h-screen place-items-center bg-slate-950 text-slate-300">
      <div className="flex items-center gap-3 text-sm">
        <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        Loading…
      </div>
    </div>
  )
}
