import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Profile from './pages/Profile.jsx';
import Matches from './pages/Matches.jsx';
import Tracker from './pages/Tracker.jsx';

function Sidebar() {
  const navClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-brand-600/30 text-brand-300 border border-brand-500/40 shadow-inner'
        : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
    }`;

  return (
    <aside className="fixed top-0 left-0 bottom-0 w-64 z-50 glass border-r border-white/5 flex flex-col">
      <div className="p-6">
        {/* Logo */}
        <NavLink to="/profile" className="flex items-center gap-3 group mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg group-hover:shadow-brand-500/30 transition-all">
            <span className="text-white font-bold text-lg">n8</span>
          </div>
          <span className="font-bold text-xl gradient-text tracking-tight">n8tern</span>
        </NavLink>

        {/* Nav links */}
        <div className="flex flex-col gap-2">
          <NavLink to="/profile" className={navClass}>
            <span className="text-lg">👤</span> Profile
          </NavLink>
          <NavLink to="/matches" className={navClass}>
            <span className="text-lg">🎯</span> Matches
          </NavLink>
          <NavLink to="/tracker" className={navClass}>
            <span className="text-lg">📋</span> Tracker
          </NavLink>
        </div>
      </div>
      
      {/* Footer Branding Area optional */}
      <div className="mt-auto p-6 border-t border-white/5">
         <p className="text-xs text-gray-500">n8tern AI matching engine</p>
      </div>
    </aside>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-transparent">
        <Sidebar />
        <main className="flex-1 ml-64 min-h-screen relative p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/profile" replace />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/matches" element={<Matches />} />
            <Route path="/tracker" element={<Tracker />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
