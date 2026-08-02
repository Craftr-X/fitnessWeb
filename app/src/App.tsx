import { Routes, Route } from 'react-router'
import { Toaster } from './components/ui/sonner'
import { Spinner } from './components/ui/spinner'
import { useAuth } from './hooks/useAuth'
import Home from './pages/Home'
import Auth from './pages/Auth'

export default function App() {
  const { user, loading } = useAuth()

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            loading ? (
              <div className="flex min-h-screen items-center justify-center">
                <Spinner className="h-8 w-8" />
              </div>
            ) : user ? (
              <Home user={user} />
            ) : (
              <Auth />
            )
          }
        />
      </Routes>
      <Toaster position="top-center" richColors />
    </>
  )
}
