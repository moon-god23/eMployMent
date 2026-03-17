import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';

function ScoreBadge({ score }) {
  if (score == null || score === 0) return <span className="score-badge-gray px-2 py-0.5 rounded-full text-xs font-semibold">Unscored</span>;
  if (score >= 70) return <span className="score-badge-green px-2 py-0.5 rounded-full text-xs font-semibold">🟢 {score}%</span>;
  if (score >= 50) return <span className="score-badge-yellow px-2 py-0.5 rounded-full text-xs font-semibold">🟡 {score}%</span>;
  return <span className="score-badge-red px-2 py-0.5 rounded-full text-xs font-semibold">🔴 {score}%</span>;
}

function ListingCard({ listing, studentId, onSave }) {
  const [saving, setSaving] = useState(false);

  const skills = listing.skills_required || [];
  const shownSkills = skills.slice(0, 4);
  const extra = skills.length - 4;

  async function handleSave() {
    if (!studentId) { toast.error('Set up your profile first!'); return; }
    setSaving(true);
    try {
      await api.post('/api/applications', { student_id: studentId, listing_id: listing.id });
      toast.success(`Saved ${listing.title} to Tracker`);
      if (onSave) onSave(listing.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass glass-hover rounded-2xl p-5 flex flex-col gap-3 animate-fade-in transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-100 text-base leading-snug">{listing.title}</h3>
          <p className="text-gray-400 text-sm mt-0.5">{listing.company}</p>
        </div>
        <ScoreBadge score={listing.match_score} />
      </div>

      {/* Skills */}
      {shownSkills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {shownSkills.map(s => <span key={s} className="skill-chip">{s}</span>)}
          {extra > 0 && <span className="skill-chip text-gray-500">+{extra}</span>}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="source-chip">{listing.source || 'manual'}</span>
          {listing.location && (
            <span className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">📍 {listing.location}</span>
          )}
          {listing.deadline && (
            <span className="text-xs text-gray-500">📅 {new Date(listing.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {listing.url && (
            <a href={listing.url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs py-1.5 px-3">
              Apply →
            </a>
          )}
          <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50">
            {saving ? '...' : '+ Save'}
          </button>
        </div>
      </div>

      {/* Match reason tooltip */}
      {listing.match_reason && (
        <p className="text-xs text-gray-500 italic border-t border-white/5 pt-2">💡 {listing.match_reason}</p>
      )}
    </div>
  );
}

export default function Matches() {
  const [listings, setListings]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [scraping, setScraping]   = useState(false);
  const [search, setSearch]       = useState('');
  const [minScore, setMinScore]   = useState('0');
  const [locFilter, setLocFilter] = useState('');
  const [lastScrape, setLastScrape] = useState(null);
  const [savedIds, setSavedIds]   = useState(new Set());

  const studentId = localStorage.getItem('n8tern_student_id');

  useEffect(() => { fetchListings(); }, []);

  async function fetchListings() {
    setLoading(true);
    try {
      // Fetch listings + student applications to get match scores
      const [listRes, appRes] = await Promise.all([
        api.get('/api/listings'),
        studentId ? api.get('/api/applications', { params: { student_id: studentId } }) : Promise.resolve({ data: { applications: [] } }),
      ]);

      const apps = appRes.data.applications || [];
      const scoreMap = Object.fromEntries(apps.map(a => [a.listing_id, { score: a.match_score, reason: a.match_reason }]));
      const savedSet = new Set(apps.map(a => a.listing_id));

      const enriched = (listRes.data.listings || []).map(l => ({
        ...l,
        match_score:  scoreMap[l.id]?.score ?? 0,
        match_reason: scoreMap[l.id]?.reason ?? null,
      }));

      setListings(enriched);
      setSavedIds(savedSet);
    } catch (err) {
      toast.error('Failed to load listings');
    } finally {
      setLoading(false);
    }
  }

  async function handleScrape(strategy = 'auto') {
    setScraping(true);
    try {
      const res = await api.post('/api/scrape', { strategy, keyword: 'software intern' });
      toast.success(`Found ${res.data.total} listings via [${res.data.strategies?.join(', ')}]`);
      
      const newListings = res.data.listings || [];
      if (studentId && newListings.length > 0) {
        toast('Running Groq AI Matching on new listings...', { icon: '🧠' });
        // Trigger matching synchronously
        await Promise.all(newListings.map(l => 
          api.post('/api/match', { listing_id: l.id, student_id: studentId }).catch(() => null)
        ));
        // Small delay to allow some background matching to complete before first refresh
        await new Promise(r => setTimeout(r, 2000));
      }
      
      setLastScrape(new Date());
      await fetchListings();
    } catch (err) {
      toast.error('Scrape failed — ' + (err.response?.data?.error || err.message));
    } finally {
      setScraping(false);
    }
  }

  const displayed = listings
    .filter(l => {
      if (search && !`${l.title} ${l.company} ${(l.skills_required||[]).join(' ')}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (minScore !== '0' && (l.match_score || 0) < parseInt(minScore)) return false;
      if (locFilter && !(l.location || 'India').toLowerCase().includes(locFilter.toLowerCase())) return false;
      return true;
    });

  const INDIAN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 
    'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar', 'Chandigarh', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
    'Remote', 'Bengaluru', 'Mumbai', 'Pune', 'Hyderabad', 'Gurugram', 'Noida', 'Chennai'
  ].sort();

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      {/* Page header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-sm text-brand-300 mb-4 border border-brand-500/20">
          🎯 AI Matching Active
        </div>
        <h1 className="text-3xl font-bold gradient-text mb-2">AI-Matched Internships</h1>
        <p className="text-gray-400">Listings scored by Groq AI (<code className="text-brand-400">llama3-70b-8192</code>) based on your profile</p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-6 text-sm text-gray-400">
        <span>📊 {listings.length} listings found</span>
        {lastScrape && <span>🕐 Last scraped {Math.round((Date.now() - lastScrape) / 60000) || '<1'} min ago</span>}
      </div>

      {/* Toolbar */}
      <div className="glass rounded-2xl p-4 flex flex-wrap gap-3 items-center mb-8">
        <input
          className="input-field flex-1 min-w-48 py-2"
          placeholder="🔍 Search listings, companies, skills..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="input-field w-auto py-2 pr-10 cursor-pointer"
          value={minScore}
          onChange={e => setMinScore(e.target.value)}
        >
          <option value="0">All Scores</option>
          <option value="50">50%+ Match</option>
          <option value="70">70%+ Match</option>
        </select>
        <select
          className="input-field w-auto py-2 pr-10 cursor-pointer"
          value={locFilter}
          onChange={e => setLocFilter(e.target.value)}
        >
          <option value="">🗺️ All India & Remote</option>
          {INDIAN_STATES.map(loc => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
        <button
          className="btn-primary"
          onClick={() => handleScrape('auto')}
          disabled={scraping}
        >
          {scraping ? <><span className="animate-spin inline-block">⟳</span> Scraping...</> : '🔄 Scrape Live'}
        </button>
        <button className="btn-secondary" onClick={fetchListings} disabled={loading}>
          ↻ Refresh
        </button>
      </div>

      {/* Listings grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="text-center">
            <div className="text-4xl animate-spin mb-3">⟳</div>
            <p className="text-gray-400">Loading listings...</p>
          </div>
        </div>
      ) : displayed.length === 0 ? (
        <div className="glass rounded-3xl p-16 text-center">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="text-xl font-semibold text-gray-200 mb-2">No listings yet</h3>
          <p className="text-gray-400 mb-6">Click "Scrape Live" to fetch from real platforms.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {displayed.map(l => (
            <ListingCard
              key={l.id}
              listing={l}
              studentId={studentId}
              onSave={id => setSavedIds(prev => new Set([...prev, id]))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
