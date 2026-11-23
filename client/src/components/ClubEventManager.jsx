import { useState, useEffect, useCallback } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { clubAPI } from '../config/api';
import { useToast } from '../context/ToastContext';

function FormField({ label, children, required }) {
    return (
        <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                {label} {required && <span className="text-purple-500">*</span>}
            </label>
            {children}
        </div>
    );
}


const STATUS_OPTIONS = ['Upcoming', 'Ongoing', 'Completed'];

const EMPTY_FORM = {
    clubId: '',
    title: '',
    description: '',
    image: '',
    venue: '',
    eventDate: '',
    timeStart: '',
    timeEnd: '',
    registrationUrl: '',
    status: 'Upcoming',
};

function toInputDate(value) {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    const offset = parsed.getTimezoneOffset();
    const local = new Date(parsed.getTime() - offset * 60 * 1000);
    return local.toISOString().slice(0, 10);
}

function parseTimeRange(time = '') {
    const parts = String(time).split(/\s*-\s*/);
    return {
        timeStart: parts[0]?.trim() || '',
        timeEnd: parts[1]?.trim() || '',
    };
}

function buildEventSchedule(eventDate, timeStart, timeEnd) {
    let date = '';
    if (eventDate) {
        const parsed = new Date(`${eventDate}T12:00:00`);
        if (!Number.isNaN(parsed.getTime())) {
            date = parsed.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
        }
    }

    let time = '';
    if (timeStart && timeEnd) time = `${timeStart} - ${timeEnd}`;
    else if (timeStart) time = timeStart;
    else if (timeEnd) time = timeEnd;

    return { date, time };
}


export default function ClubEventManager() {
    const { addToast } = useToast();

    // Data state
    const [clubs, setClubs] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Filter
    const [filterClubId, setFilterClubId] = useState('');

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);

    // Delete confirmation
    const [deletingId, setDeletingId] = useState(null);

    // ── Fetch clubs ──────────────────────────────────────────────────────────
    const fetchClubs = useCallback(async () => {
        try {
            const res = await clubAPI.getClubs();
            setClubs(res.clubs || []);
        } catch {
            addToast('Failed to load clubs', 'error');
        }
    }, [addToast]);

    // ── Fetch events ─────────────────────────────────────────────────────────
    const fetchEvents = useCallback(async () => {
        try {
            setLoading(true);
            const res = await clubAPI.getAllEvents(filterClubId || undefined);
            setEvents(res.events || []);
        } catch {
            addToast('Failed to load events', 'error');
        } finally {
            setLoading(false);
        }
    }, [filterClubId, addToast]);

    useEffect(() => { fetchClubs(); }, [fetchClubs]);
    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    // ── Form handlers ────────────────────────────────────────────────────────
    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const openCreateForm = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setShowForm(true);
    };

    const openEditForm = (event) => {
        const { timeStart, timeEnd } = parseTimeRange(event.time);
        setEditingId(event._id);
        setForm({
            clubId: event.club?._id || event.club || '',
            title: event.title || '',
            description: event.description || '',
            image: event.image || '',
            venue: event.venue || '',
            eventDate: toInputDate(event.date),
            timeStart,
            timeEnd,
            registrationUrl: event.registrationUrl || '',
            status: event.status || 'Upcoming',
        });
        setShowForm(true);
    };

    const cancelForm = () => {
        setShowForm(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
    };

    // ── Validate form ────────────────────────────────────────────────────────
    const validateForm = () => {
        if (!form.clubId) { addToast('Please select a club', 'error'); return false; }
        if (!form.title.trim()) { addToast('Event title is required', 'error'); return false; }
        if (form.registrationUrl && !/^https?:\/\/.+/.test(form.registrationUrl)) {
            addToast('Registration URL must start with http:// or https://', 'error');
            return false;
        }
        if (form.image && !/^https?:\/\/.+/.test(form.image)) {
            addToast('Image URL must start with http:// or https://', 'error');
            return false;
        }
        return true;
    };

    // ── Submit (Create / Update) ─────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!validateForm()) return;

        try {
            setSubmitting(true);
            const { date, time } = buildEventSchedule(form.eventDate, form.timeStart, form.timeEnd);
            
            // Find selected club name for labeling
            const matchedClub = clubs.find(c => c._id === form.clubId);
            const clubName = matchedClub?.name || '';

            const payload = {
                clubId: form.clubId,
                title: form.title,
                description: form.description,
                image: form.image,
                venue: form.venue,
                date,
                time,
                registrationUrl: form.registrationUrl,
                status: form.status,
                // Flags added so event surfaces in Hackathons view
                isCollegeFeatured: true,
                isCollegeEvent: true,
                scope: 'GNDEC',
                type: 'Club Event',
                clubName: clubName,
                organizer: clubName
            };

            if (editingId) {
                await clubAPI.updateEvent(editingId, payload);
                addToast('Event updated successfully', 'success');
            } else {
                await clubAPI.createEvent(payload);
                addToast('Event created successfully', 'success');
            }
            
            // Dispatch dynamic window event to notify subscribers (e.g. Hackathons component)
            window.dispatchEvent(new CustomEvent('hackathons-changed'));
            
            cancelForm();
            fetchEvents();
        } catch (err) {
            addToast(err?.message || 'Operation failed', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Delete ───────────────────────────────────────────────────────────────
    const handleDelete = async (id) => {
        try {
            await clubAPI.deleteEvent(id);
            addToast('Event deleted', 'success');
            setDeletingId(null);
            
            // Dispatch dynamic window event on deletion
            window.dispatchEvent(new CustomEvent('hackathons-changed'));
            
            fetchEvents();
        } catch {
            addToast('Failed to delete event', 'error');
        }
    };

    // ── Helpers ──────────────────────────────────────────────────────────────
    const getClubName = (event) => {
        if (typeof event.club === 'object' && event.club?.name) return event.club.name;
        const match = clubs.find(c => c._id === event.club);
        return match?.name || 'Unknown';
    };

    const statusColors = {
        Upcoming: 'bg-purple-500/10 text-purple-400',
        Ongoing: 'bg-green-500/10 text-green-400',
        Completed: 'bg-white/5 text-white/40',
    };

    return (
        <div>
            {/* ─── Section Header ──────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
                <div>
                    <div className="flex items-center gap-2 text-[10px] font-black text-[#a855f7] uppercase tracking-[0.3em] mb-2">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                            <path d="M2 17l10 5 10-5" />
                            <path d="M2 12l10 5 10-5" />
                        </svg>
                        Club Notification Puller
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tighter">
                        Manage Club Events
                    </h2>
                </div>

                <button
                    onClick={openCreateForm}
                    className="btn-primary !w-auto px-6 !py-2.5 text-xs flex items-center gap-2"
                >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    New Event
                </button>
            </div>

            {/* ─── Club Filter ──────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6">
                <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Filter:</span>
                <select
                    value={filterClubId}
                    onChange={e => setFilterClubId(e.target.value)}
                    className="input-field !w-auto !py-2 !px-3 text-xs min-w-0 flex-1 sm:flex-none"
                >
                    <option value="" className="bg-[#111115]">All Clubs</option>
                    {clubs.length > 0 ? (
                        clubs.map(c => (
                            <option key={c._id} value={c._id} className="bg-[#111115]">{c.name}</option>
                        ))
                    ) : (
                        <option disabled className="bg-[#111115]">No clubs found</option>
                    )}
                </select>
            </div>

            {/* ─── Form Modal ──────────────────────────────────────────────── */}
            <AnimatePresence>
                {showForm && (
                    <div
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pt-[80px] pb-[100px] md:py-12 bg-black/40 backdrop-blur-sm"
                        onClick={cancelForm}
                    >
                        <m.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-[24px] p-5 sm:p-8 w-full md:max-w-2xl shadow-2xl relative flex flex-col max-h-full md:max-h-[80vh]"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-6 pb-4 border-b border-gray-100 shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600">
                                        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                            <line x1="16" y1="2" x2="16" y2="6"></line>
                                            <line x1="8" y1="2" x2="8" y2="6"></line>
                                            <line x1="3" y1="10" x2="21" y2="10"></line>
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                                            {editingId ? 'Edit Event' : 'Create New Event'}
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1 font-medium">Add a new event and keep your community updated</p>
                                    </div>
                                </div>
                                <button type="button" onClick={cancelForm} className="p-2 rounded-full bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-all">
                                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Scrollable Body */}
                            <div className="overflow-y-auto pr-2 custom-scrollbar-dark flex-1 min-h-0">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                    <FormField label="Select Club" required>
                                        <select
                                            value={form.clubId}
                                            onChange={e => handleChange('clubId', e.target.value)}
                                            className="w-full bg-[#f0f4f8] text-gray-900 text-sm font-semibold rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#a855f7] transition-all"
                                        >
                                            <option value="">Choose a club...</option>
                                            {clubs.length > 0 ? (
                                                clubs.map(c => (
                                                    <option key={c._id} value={c._id}>{c.name}</option>
                                                ))
                                            ) : (
                                                <option disabled>No clubs available</option>
                                            )}
                                        </select>
                                    </FormField>

                                    <FormField label="Status" required>
                                        <select
                                            value={form.status}
                                            onChange={e => handleChange('status', e.target.value)}
                                            className="w-full bg-[#f0f4f8] text-gray-900 text-sm font-semibold rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#a855f7] transition-all"
                                        >
                                            {STATUS_OPTIONS.map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </FormField>

                                    <FormField label="Event Title" required>
                                        <input
                                            type="text"
                                            value={form.title}
                                            onChange={e => handleChange('title', e.target.value)}
                                            placeholder="Enter event title"
                                            className="w-full bg-[#f0f4f8] text-gray-900 text-sm font-semibold rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#a855f7] transition-all"
                                            maxLength={200}
                                        />
                                    </FormField>

                                    <FormField label="Venue">
                                        <input
                                            type="text"
                                            value={form.venue}
                                            onChange={e => handleChange('venue', e.target.value)}
                                            placeholder="e.g. Auditorium Hall A"
                                            className="w-full bg-[#f0f4f8] text-gray-900 text-sm font-semibold rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#a855f7] transition-all"
                                        />
                                    </FormField>

                                    <FormField label="Date">
                                        <input
                                            type="date"
                                            value={form.eventDate}
                                            onChange={e => handleChange('eventDate', e.target.value)}
                                            className="w-full bg-[#f0f4f8] text-gray-900 text-sm font-semibold rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#a855f7] transition-all"
                                        />
                                    </FormField>

                                    <FormField label="Start time">
                                        <input
                                            type="time"
                                            value={form.timeStart}
                                            onChange={e => handleChange('timeStart', e.target.value)}
                                            className="w-full bg-[#f0f4f8] text-gray-900 text-sm font-semibold rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#a855f7] transition-all"
                                        />
                                    </FormField>

                                    <FormField label="End time">
                                        <input
                                            type="time"
                                            value={form.timeEnd}
                                            onChange={e => handleChange('timeEnd', e.target.value)}
                                            className="w-full bg-[#f0f4f8] text-gray-900 text-sm font-semibold rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#a855f7] transition-all"
                                        />
                                    </FormField>

                                    <FormField label="Event Image URL">
                                        <input
                                            type="url"
                                            value={form.image}
                                            onChange={e => handleChange('image', e.target.value)}
                                            placeholder="https://..."
                                            className="w-full bg-[#f0f4f8] text-gray-900 text-sm font-semibold rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#a855f7] transition-all"
                                        />
                                        {form.image && /^https?:\/\/.+/.test(form.image) && (
                                            <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                                                <img
                                                    src={form.image}
                                                    alt="Preview"
                                                    className="w-full h-32 object-cover"
                                                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                                    onLoad={(e) => { e.target.style.display = 'block'; e.target.nextSibling.style.display = 'none'; }}
                                                />
                                                <div className="hidden items-center justify-center h-32 text-gray-400 text-xs">
                                                    Could not load image — check the URL
                                                </div>
                                            </div>
                                        )}
                                    </FormField>

                                    <FormField label="Registration URL">
                                        <input
                                            type="url"
                                            value={form.registrationUrl}
                                            onChange={e => handleChange('registrationUrl', e.target.value)}
                                            placeholder="https://..."
                                            className="w-full bg-[#f0f4f8] text-gray-900 text-sm font-semibold rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#a855f7] transition-all"
                                        />
                                    </FormField>

                                    <div className="sm:col-span-2">
                                        <FormField label="Description">
                                            <textarea
                                                value={form.description}
                                                onChange={e => handleChange('description', e.target.value)}
                                                placeholder="Describe the event..."
                                                rows={3}
                                                className="w-full bg-[#f0f4f8] text-gray-900 text-sm font-semibold rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-[#a855f7] transition-all resize-none"
                                                maxLength={1000}
                                            />
                                        </FormField>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-100 shrink-0">
                                <button
                                    type="button"
                                    onClick={cancelForm}
                                    className="hidden sm:flex px-8 py-3 rounded-full bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200 transition-all items-center justify-center"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="w-full sm:w-auto px-8 py-3 rounded-full bg-[#a855f7] text-white text-sm font-bold hover:bg-[#9333ea] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <span className="animate-spin h-4 w-4 border-2 border-white/20 border-t-white rounded-full" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            {editingId ? 'Update Event' : 'Create Event'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </m.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ─── Events List ─────────────────────────────────────────────── */}
            <m.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass overflow-hidden"
            >
                <div className="p-4 sm:p-5 border-b border-white/5">
                    <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                        Events
                        <span className="text-[10px] font-black bg-white/5 px-2 py-0.5 rounded text-white/40">{events.length}</span>
                    </h3>
                </div>

                {loading ? (
                    <div className="p-12 flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#7c3aed]" />
                    </div>
                ) : events.length === 0 ? (
                    <div className="py-16 text-center">
                        <p className="text-white/20 font-bold uppercase tracking-widest text-sm">No events found</p>
                        <p className="text-white/10 text-xs mt-1">Create one using the button above.</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-[10px] font-black text-white/20 uppercase tracking-[0.15em] border-b border-white/5">
                                        <th className="px-5 py-4">Title</th>
                                        <th className="px-5 py-4">Club</th>
                                        <th className="px-5 py-4">Status</th>
                                        <th className="px-5 py-4">Date</th>
                                        <th className="px-5 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    <AnimatePresence>
                                        {events.map((event, idx) => (
                                            <m.tr
                                                key={event._id}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                transition={{ delay: idx * 0.03 }}
                                                className="group hover:bg-white/[0.02] transition-colors"
                                            >
                                                <td className="px-5 py-4">
                                                    <span className="text-sm font-bold text-white/80 group-hover:text-[#a855f7] transition-colors line-clamp-1">
                                                        {event.title}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-xs text-white/40 font-semibold">{getClubName(event)}</span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${statusColors[event.status] || statusColors.Upcoming}`}>
                                                        {event.status}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-[11px] text-white/30 font-mono">{event.date || '—'}</span>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => openEditForm(event)}
                                                            className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:text-[#a855f7] hover:bg-purple-500/10 transition-all"
                                                            title="Edit"
                                                        >
                                                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                            </svg>
                                                        </button>

                                                        {deletingId === event._id ? (
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={() => handleDelete(event._id)}
                                                                    className="px-2 py-1 rounded text-[9px] font-black bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                                                                >
                                                                    Confirm
                                                                </button>
                                                                <button
                                                                    onClick={() => setDeletingId(null)}
                                                                    className="px-2 py-1 rounded text-[9px] font-black bg-white/5 text-white/30 hover:text-white transition-all"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => setDeletingId(event._id)}
                                                                className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                                                title="Delete"
                                                            >
                                                                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                                    <polyline points="3 6 5 6 21 6" />
                                                                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </m.tr>
                                        ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card Layout */}
                        <div className="md:hidden divide-y divide-white/5">
                            <AnimatePresence>
                                {events.map((event, idx) => (
                                    <m.div
                                        key={event._id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ delay: idx * 0.03 }}
                                        className="p-4 hover:bg-white/[0.02] transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-bold text-white/80 line-clamp-1">{event.title}</h4>
                                                <p className="text-[11px] text-white/30 mt-0.5">{getClubName(event)}</p>
                                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${statusColors[event.status] || statusColors.Upcoming}`}>
                                                        {event.status}
                                                    </span>
                                                    {event.date && (
                                                        <span className="text-[10px] text-white/20 font-mono">{event.date}</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={() => openEditForm(event)}
                                                    className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-[#a855f7] hover:bg-purple-500/10 transition-all"
                                                    title="Edit"
                                                >
                                                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                    </svg>
                                                </button>

                                                {deletingId === event._id ? (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleDelete(event._id)}
                                                            className="px-2 py-1.5 rounded text-[9px] font-black bg-red-500/20 text-red-400"
                                                        >
                                                            Yes
                                                        </button>
                                                        <button
                                                            onClick={() => setDeletingId(null)}
                                                            className="px-2 py-1.5 rounded text-[9px] font-black bg-white/5 text-white/30"
                                                        >
                                                            No
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setDeletingId(event._id)}
                                                        className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                                        title="Delete"
                                                    >
                                                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </m.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </>
                )}
            </m.div>
        </div>
    );
}