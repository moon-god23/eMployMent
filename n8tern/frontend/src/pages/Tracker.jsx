import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import toast from 'react-hot-toast';
import api from '../lib/api.js';

const COLUMNS = [
  { id: 'saved',     label: 'Saved',     emoji: '📌', color: 'from-blue-500/20 to-blue-600/10',   border: 'border-blue-500/20',   badge: 'bg-blue-500/30 text-blue-300'   },
  { id: 'applied',   label: 'Applied',   emoji: '📤', color: 'from-amber-500/20 to-amber-600/10', border: 'border-amber-500/20',  badge: 'bg-amber-500/30 text-amber-300'  },
  { id: 'interview', label: 'Interview', emoji: '💬', color: 'from-brand-500/20 to-brand-600/10', border: 'border-brand-500/20',  badge: 'bg-brand-500/30 text-brand-300'  },
  { id: 'offer',     label: 'Offer',     emoji: '🎉', color: 'from-green-500/20 to-green-600/10',  border: 'border-green-500/20', badge: 'bg-green-500/30 text-green-300'  },
];

function ScoreBadge({ score }) {
  if (!score) return null;
  const cls = score >= 70 ? 'score-badge-green' : score >= 50 ? 'score-badge-yellow' : 'score-badge-red';
  return <span className={`${cls} px-2 py-0.5 rounded-full text-xs font-semibold`}>{score}%</span>;
}

async function handleSendTelegram(app) {
  const telegramId = app.student?.telegram_chat_id;
  if (!telegramId) return toast.error('No Telegram ID found in profile');

  const payload = {
    chat_id: telegramId,
    title: app.listings?.title || 'Unknown Role',
    company: app.listings?.company || 'Unknown Company',
    url: app.listings?.url || 'No link provided',
    deadline: app.listings?.deadline || 'No deadline',
  };

  try {
    const toastId = toast.loading('Sending to Telegram...');
    // Calls the n8n webhook (VITE_N8N_WEBHOOK_URL should be set in production)
    const n8nUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/n8tern-telegram';
    await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    toast.success('Sent to Telegram!', { id: toastId });
  } catch (err) {
    toast.error('Failed to contact n8n webhook');
  }
}

function KanbanCard({ app, isDragging }) {
  const listing  = app.listings || {};
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: app.id });

  const style = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="glass glass-hover rounded-xl p-4 cursor-grab active:cursor-grabbing outline-none"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-medium text-sm text-gray-100 leading-snug">{listing.title || 'Unknown Role'}</p>
          <p className="text-xs text-gray-400 mt-0.5">{listing.company || '—'}</p>
        </div>
        <div className="flex items-center gap-2">
          <ScoreBadge score={app.match_score} />
          {app.student?.telegram_chat_id && (
            <button 
              onClick={() => handleSendTelegram(app)}
              className="text-gray-400 hover:text-blue-400 transition-colors"
              title="Send to Telegram"
            >
              ✈️
            </button>
          )}
          {/* Drag handle (visual only now since the whole card is draggable) */}
          <div className="text-gray-600 mt-0.5 ml-1 pointer-events-none">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="8" cy="6" r="2"/><circle cx="16" cy="6" r="2"/>
              <circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/>
              <circle cx="8" cy="18" r="2"/><circle cx="16" cy="18" r="2"/>
            </svg>
          </div>
        </div>
      </div>
      {/* Skills */}
      {listing.skills_required?.slice(0,3).length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {listing.skills_required.slice(0,3).map(s => <span key={s} className="skill-chip">{s}</span>)}
        </div>
      )}
      {/* Date */}
      <p className="text-xs text-gray-600 mt-1">
        {app.applied_at ? new Date(app.applied_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
      </p>
    </div>
  );
}

function DroppableColumn({ id, className, children }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  );
}

function EmptyColumn() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center opacity-40">
      <div className="text-4xl mb-2">📭</div>
      <p className="text-sm text-gray-500">Drag cards here</p>
    </div>
  );
}

export default function Tracker() {
  const [apps, setApps]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [activeId, setActiveId] = useState(null);

  const studentId = localStorage.getItem('n8tern_student_id');

  useEffect(() => { fetchApps(); }, []);

  async function fetchApps() {
    if (!studentId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.get('/api/applications', { params: { student_id: studentId } });
      setApps(res.data.applications || []);
    } catch (err) {
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function getApp(id) { return apps.find(a => a.id === id); }

  function handleDragStart({ active }) { setActiveId(active.id); }

  async function handleDragEnd({ active, over }) {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    // Find destination column id
    const destColId = COLUMNS.find(c => c.id === over.id)?.id
      ?? apps.find(a => a.id === over.id)?.status;

    if (!destColId) return;

    const app = getApp(active.id);
    if (!app || app.status === destColId) return;

    // Optimistic update
    setApps(prev => prev.map(a => a.id === active.id ? { ...a, status: destColId } : a));

    try {
      await api.put(`/api/applications/${active.id}`, { status: destColId });
      toast.success(`Moved to ${destColId.charAt(0).toUpperCase() + destColId.slice(1)}`);
    } catch (err) {
      toast.error('Failed to update status');
      setApps(prev => prev.map(a => a.id === active.id ? { ...a, status: app.status } : a)); // revert
    }
  }

  async function handleClearAll() {
    if (!studentId) return;
    if (!window.confirm('Are you sure you want to clear all your saved applications? This cannot be undone.')) return;
    
    setLoading(true);
    try {
      await api.delete('/api/applications/clear', { params: { student_id: studentId } });
      setApps([]);
      toast.success('All applications cleared.');
    } catch (err) {
      toast.error('Failed to clear applications');
    } finally {
      setLoading(false);
    }
  }

  if (!studentId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-3xl p-12 text-center max-w-md">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-xl font-semibold mb-3">No Profile Yet</h2>
          <p className="text-gray-400 mb-6">Set up your profile first to start tracking applications.</p>
          <a href="/profile" className="btn-primary">👤 Setup Profile</a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="text-center"><div className="text-4xl animate-spin mb-3">⟳</div><p className="text-gray-400">Loading your tracker...</p></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-sm text-brand-300 mb-4 border border-brand-500/20">
            📋 Application Tracker
          </div>
          <h1 className="text-3xl font-bold gradient-text mb-2">My Applications</h1>
          <p className="text-gray-400">Drag cards between columns to update your application status</p>
        </div>
        {apps.length > 0 && (
          <button 
            onClick={handleClearAll}
            className="btn-secondary text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/20"
          >
            🗑️ Clear All Saved
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4 mb-8">
        {COLUMNS.map(col => {
          const count = apps.filter(a => a.status === col.id).length;
          return (
            <div key={col.id} className="glass rounded-xl px-5 py-3 flex items-center gap-3">
              <span>{col.emoji}</span>
              <div>
                <p className="text-xs text-gray-500">{col.label}</p>
                <p className="font-bold text-lg text-gray-100">{count}</p>
              </div>
            </div>
          );
        })}
        <div className="glass rounded-xl px-5 py-3 flex items-center gap-3">
          <span>📊</span>
          <div>
            <p className="text-xs text-gray-500">Total</p>
            <p className="font-bold text-lg text-gray-100">{apps.length}</p>
          </div>
        </div>
      </div>

      {/* Kanban board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {COLUMNS.map(col => {
            const colApps = apps.filter(a => a.status === col.id);
            return (
              <DroppableColumn key={col.id} id={col.id} className={`kanban-column bg-gradient-to-br ${col.color} border ${col.border}`}>
                {/* Column header */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-sm text-gray-200 flex items-center gap-2">
                    <span>{col.emoji}</span>{col.label}
                  </h2>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.badge}`}>{colApps.length}</span>
                </div>

                {/* Cards */}
                <SortableContext items={colApps.map(a => a.id)} strategy={verticalListSortingStrategy} id={col.id}>
                  {colApps.length === 0 ? <EmptyColumn /> : (
                    <div className="flex flex-col gap-2.5">
                      {colApps.map(app => (
                        <KanbanCard key={app.id} app={app} isDragging={activeId === app.id} />
                      ))}
                    </div>
                  )}
                </SortableContext>
              </DroppableColumn>
            );
          })}
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeId ? (
            <div className="glass rounded-xl p-4 shadow-2xl shadow-brand-500/20 border border-brand-500/40 opacity-90 rotate-2">
              <p className="text-sm font-medium text-gray-200">
                {apps.find(a => a.id === activeId)?.listings?.title || 'Application'}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {apps.length === 0 && (
        <div className="glass rounded-3xl p-12 text-center mt-8">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="text-xl font-semibold text-gray-200 mb-2">No applications yet</h3>
          <p className="text-gray-400 mb-6">Browse listings in Matches and click "+ Save" to add them here</p>
          <a href="/matches" className="btn-primary">🎯 Browse Matches</a>
        </div>
      )}
    </div>
  );
}
