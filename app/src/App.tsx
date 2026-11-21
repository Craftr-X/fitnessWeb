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
      {/* 具体 Tab（/today /plan /data）由 Home 自己按 URL 解析，这里只做登录态闸门。
          HashRouter 下深链接形如 #/plan，GitHub Pages 上刷新不会 404 */}
      <Routes>
        <Route
          path="*"
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
