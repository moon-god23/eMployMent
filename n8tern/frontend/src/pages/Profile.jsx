import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';

const BRANCHES = ['CSE', 'ECE', 'ME', 'EE', 'Civil', 'Chemical', 'IT', 'Other'];
const ROLES    = ['Frontend', 'Backend', 'Full Stack', 'ML Engineer', 'Data Scientist', 'DevOps', 'Android', 'iOS', 'PM', 'UI/UX'];

export default function Profile() {
  const [form, setForm]     = useState({ name: '', whatsapp: '', telegram_chat_id: '', branch: 'CSE', cgpa: '', skills: '', preferred_roles: [] });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved]     = useState(false);

  // Reload saved profile on mount
  useEffect(() => {
    const id = localStorage.getItem('n8tern_student_id');
    if (!id) return;
    api.get('/api/students').then(res => {
      const me = res.data.students?.find(s => s.id === id);
      if (me) {
        setForm({
          name:            me.name,
          whatsapp:        me.whatsapp,
          telegram_chat_id: me.telegram_chat_id || '',
          branch:          me.branch || 'CSE',
          cgpa:            me.cgpa?.toString() || '',
          skills:          (me.skills || []).join(', '),
          preferred_roles: me.preferred_roles || [],
        });
        setSaved(true);
      }
    }).catch(() => {});
  }, []);

  function toggleRole(role) {
    setForm(f => ({
      ...f,
      preferred_roles: f.preferred_roles.includes(role)
        ? f.preferred_roles.filter(r => r !== role)
        : [...f.preferred_roles, role],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.whatsapp) {
      toast.error('Name and WhatsApp number are required');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/api/students', {
        name:            form.name,
        whatsapp:        form.whatsapp,
        telegram_chat_id: form.telegram_chat_id || null,
        branch:          form.branch,
        cgpa:            form.cgpa || null,
        skills:          form.skills,
        preferred_roles: form.preferred_roles,
      });
      localStorage.setItem('n8tern_student_id', res.data.student.id);
      setSaved(true);
      toast.success('✅ Profile saved! Head to Matches to find internships.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-12 flex items-start justify-center">
      <div className="w-full max-w-2xl animate-slide-up">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-brand-300 mb-4 border border-brand-500/20">
            <span>👤</span> Student Profile
          </div>
          <h1 className="text-4xl font-bold mb-3 gradient-text">Setup Your Profile</h1>
          <p className="text-gray-400">Fill in your details so Groq AI can match you with the best internships</p>
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} className="glass rounded-3xl p-8 space-y-6">
          {/* Name + WhatsApp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="label">Full Name</label>
              <input
                className="input-field"
                placeholder="Arjun Sharma"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">WhatsApp Number</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">+91</span>
                <input
                  className="input-field pl-14"
                  placeholder="9876543210"
                  value={form.whatsapp.replace(/^\+91/, '')}
                  onChange={e => setForm(f => ({ ...f, whatsapp: '+91' + e.target.value.replace(/\D/g, '') }))}
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Used for WhatsApp match alerts</p>
           </div>
          </div>

          {/* Optional Telegram ID */}
          <div>
            <label className="label">Telegram Chat ID (Optional)</label>
            <input
              className="input-field"
              placeholder="e.g. 123456789"
              value={form.telegram_chat_id}
              onChange={e => setForm(f => ({ ...f, telegram_chat_id: e.target.value }))}
            />
            <p className="text-xs text-gray-500 mt-1">Get your Chat ID by messaging @userinfobot on Telegram. This is used for n8n alerts.</p>
          </div>

          {/* Branch + CGPA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="label">Branch</label>
              <select
                className="input-field"
                value={form.branch}
                onChange={e => setForm(f => ({ ...f, branch: e.target.value }))}
              >
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="label">CGPA</label>
              <input
                className="input-field"
                type="number"
                min="0"
                max="10"
                step="0.01"
                placeholder="8.5"
                value={form.cgpa}
                onChange={e => setForm(f => ({ ...f, cgpa: e.target.value }))}
              />
            </div>
          </div>

          {/* Skills */}
          <div>
            <label className="label">Skills</label>
            <input
              className="input-field"
              placeholder="React, Python, Node.js, SQL, Docker..."
              value={form.skills}
              onChange={e => setForm(f => ({ ...f, skills: e.target.value }))}
            />
            <p className="text-xs text-gray-500 mt-1">Comma-separated — these are used for AI matching</p>
          </div>

          {/* Preferred Roles */}
          <div>
            <label className="label">Preferred Roles</label>
            <div className="flex flex-wrap gap-2">
              {ROLES.map(role => {
                const selected = form.preferred_roles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${
                      selected
                        ? 'bg-brand-600/40 border-brand-400/60 text-brand-200 shadow-lg shadow-brand-500/10'
                        : 'bg-transparent border-gray-700/60 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                    }`}
                  >
                    {role}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center text-base py-3 disabled:opacity-50 disabled:cursor-not-allowed animate-glow-pulse"
          >
            {loading ? (
              <><span className="animate-spin">⟳</span> Saving...</>
            ) : saved ? (
              '✅ Update Profile'
            ) : (
              '🚀 Save Profile & Start Matching'
            )}
          </button>

          {saved && (
            <p className="text-center text-sm text-green-400">
              ✓ Profile saved — check <a href="/matches" className="underline hover:text-green-300">Matches</a> for AI-scored internships
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
