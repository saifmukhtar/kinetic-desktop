import { HashRouter, Routes, Route } from 'react-router-dom'
import TopBar from './components/TopBar'
import Dashboard from './pages/Dashboard'
import Names from './pages/Names'
import Dns from './pages/Dns'
import Network from './pages/Network'
import Kid from './pages/Kid'
import Atlas from './pages/Atlas'
import Settings from './pages/Settings'
import './styles/global.css'

export default function App() {
  return (
    <HashRouter>
      <TopBar />
      <main style={{ paddingTop: 'var(--topbar-height)', height: '100dvh', overflowY: 'auto' }}>
        <Routes>
          <Route path="/"         element={<Dashboard />} />
          <Route path="/names"    element={<Names />} />
          <Route path="/dns"      element={<Dns />} />
          <Route path="/network"  element={<Network />} />
          <Route path="/kid"      element={<Kid />} />
          <Route path="/atlas"    element={<Atlas />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </HashRouter>
  )
}
