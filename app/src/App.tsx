import { Routes, Route } from 'react-router'
import { Toaster } from './components/ui/sonner'
import AppSplash from './components/AppSplash'
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
              <AppSplash tip="正在恢复登录状态…" />
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
