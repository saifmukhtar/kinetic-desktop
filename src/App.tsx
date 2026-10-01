import { HashRouter, Routes, Route } from 'react-router-dom'
import TopBar from './components/TopBar'
import WindowResizer from './components/WindowResizer'
import Dashboard from './pages/Dashboard'
import Names from './pages/Names'
import Nrs from './pages/Nrs'
import Network from './pages/Network'
import Kid from './pages/Kid'
import Identity from './pages/Identity'
import Settings from './pages/Settings'
import './styles/global.css'

export default function App() {
  return (
    <HashRouter>
      <WindowResizer />
      <TopBar />
      <main style={{ paddingTop: 'var(--pill-offset)', height: '100dvh', overflowY: 'auto' }}>
        <Routes>
          <Route path="/"         element={<Dashboard />} />
          <Route path="/names"    element={<Names />} />
          <Route path="/nrs"      element={<Nrs />} />
          <Route path="/network"  element={<Network />} />
          <Route path="/kid"      element={<Kid />} />
          <Route path="/identity" element={<Identity />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </HashRouter>
  )
}
