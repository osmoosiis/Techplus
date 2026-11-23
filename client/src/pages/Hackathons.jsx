import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { useToast } from '../context/ToastContext'
import { hackathonAPI, clubAPI, clearHackathonListCache } from '../config/api'
import { getFallbackImage } from '../utils/imageUtils'

const normalizeKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

const getHackathonKey = (hackathon) => {
  if (!hackathon) return ''
  if (hackathon._id) return String(hackathon._id)
  if (hackathon.sourceKey) return `source:${normalizeKey(hackathon.sourceKey)}`
  if (hackathon.sourceUrl) return `url:${normalizeKey(hackathon.sourceUrl)}`
  if (hackathon.registrationLink) return `link:${normalizeKey(hackathon.registrationLink)}`
  return `${normalizeKey(hackathon.title)}|${String(hackathon.startDate || '').slice(0, 10)}`
}

const isEnded = (hackathon) => {
  const end = new Date(hackathon.endDate || hackathon.startDate)
  return !isNaN(end.getTime()) && end < new Date()
}

const chipBase =
  'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur border border-white/10 text-white/75 text-[11px]'

function UniformCard({ hackathon, idx, isBookmarked, getStatusBadge, formatDate, toggleBookmark, onSelect }) {
  const status = getStatusBadge(hackathon)
  const isCollege = Boolean(hackathon.isCollegeFeatured) || Boolean(hackathon.clubName) || hackathon.tags?.includes('Campus Event')
  const fallback = getFallbackImage('Startups', hackathon.title, hackathon._id, 0)
  const venue = hackathon.location || hackathon.venue
  const dateText = hackathon.endDate && hackathon.endDate !== hackathon.startDate
    ? `${formatDate(hackathon.startDate)} - ${formatDate(hackathon.endDate)}`
    : formatDate(hackathon.startDate)

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.04, 0.35), duration: 0.35 }}
      onClick={() => onSelect(hackathon)}
      className={`group relative flex flex-col justify-between rounded-3xl border overflow-hidden cursor-pointer bg-[#0d0d12] h-[340px] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.45)] ${
        isCollege
          ? 'border-[#a855f7]/30 hover:border-[#a855f7]/70'
          : 'border-white/10 hover:border-[#7c3aed]/70'
      }`}
    >
      {/* Background Image */}
      <img
        src={hackathon.image || fallback}
        alt={hackathon.title}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-40"
        onError={(e) => {
          e.currentTarget.onerror = null
          e.currentTarget.src = fallback
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-[#09090b]/20" />

      {/* Top Bar: Badges + Bookmark */}
      <div className="relative z-10 p-4 flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 min-w-0">
          <span className="rounded-full bg-black/60 backdrop-blur">
            <span className={`block px-3 py-1 rounded-full text-[10px] font-bold ${status.color}`}>
              {status.text}
            </span>
          </span>
          {isCollege ? (
            <span className="px-2.5 py-1 rounded-full bg-[#a855f7]/20 backdrop-blur border border-[#a855f7]/40 text-[9px] font-black text-[#d8b4fe] uppercase tracking-widest flex items-center gap-1">
              📍 GNDEC CAMPUS
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur border border-white/10 text-[9px] font-black text-white/70 uppercase tracking-widest flex items-center">
              GLOBAL HACKATHON
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            toggleBookmark(hackathon._id)
          }}
          className={`shrink-0 px-3 py-1 rounded-full backdrop-blur transition-colors text-[10px] font-bold tracking-wide ${
            isBookmarked
              ? 'bg-yellow-500/25 text-yellow-300 border border-yellow-500/30'
              : 'bg-black/50 text-white/70 hover:text-white border border-white/10'
          }`}
        >
          {isBookmarked ? 'SAVED' : 'SAVE'}
        </button>
      </div>

      {/* Bottom Content Area */}
      <div className="relative z-10 p-5 flex flex-col justify-end">
        {(hackathon.organizer || hackathon.clubName) && (
          <p className="text-xs text-[#a855f7] font-semibold mb-1 truncate">
            {hackathon.clubName || hackathon.organizer}
          </p>
        )}

        <h3 className="font-black text-lg text-white line-clamp-1 tracking-tight mb-2">
          {hackathon.title}
        </h3>

        <div className="flex flex-wrap gap-1.5 text-[11px] mb-3">
          <span className={chipBase}> {dateText}</span>
          {venue && <span className={`${chipBase} max-w-[150px] truncate`}> {venue}</span>}
          <span className={chipBase}>{hackathon.mode || 'Offline'}</span>
          {hackathon.prize && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 backdrop-blur max-w-[150px] truncate">
               {hackathon.prize}
            </span>
          )}
        </div>

        {hackathon.tags && hackathon.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {hackathon.tags.slice(0, 3).map((tag, tagIdx) => (
              <span
                key={tagIdx}
                className="text-[10px] px-2 py-0.5 rounded bg-[#7c3aed]/20 text-[#d8b4fe] border border-[#7c3aed]/30"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </m.div>
  )
}

export default function Hackathons() {
  const { addToast } = useToast()

  const [hackathons, setHackathons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [bookmarks, setBookmarks] = useState([])

  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [modeFilter, setModeFilter] = useState('All')
  const [scopeFilter, setScopeFilter] = useState('All') // 'All' vs 'GNDEC'
  const [selectedClub, setSelectedClub] = useState('All')
  const [viewMode, setViewMode] = useState('browse')
  const [selectedHackathon, setSelectedHackathon] = useState(null)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    setIsExpanded(false)
  }, [selectedHackathon])

  const fetchClubEvents = async () => {
    try {
      const res = await clubAPI.getAllEvents()
      const rawEvents = res.events || res.data || []
      
      return rawEvents.map(event => {
        const clubName = event.club?.name || event.clubName || event.organizer || 'Campus Club'
        return {
          _id: event._id || `club-${Math.random()}`,
          title: event.title,
          description: event.description,
          startDate: event.date || event.eventDate,
          endDate: event.endDate || event.date || event.eventDate,
          time: event.time,
          venue: event.venue,
          location: event.venue || 'GNDEC Campus',
          registrationLink: event.registrationUrl,
          image: event.image,
          isCollegeFeatured: true,
          clubName: clubName,
          organizer: clubName,
          mode: event.mode || 'Offline',
          tags: [clubName, 'Campus Event']
        }
      })
    } catch {
      return []
    }
  }

  const loadHackathons = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true)
      setError(null)

      const [cachedHackathonsRes, clubEvents] = await Promise.all([
        hackathonAPI.getAll({}),
        fetchClubEvents()
      ])

      let combined = [...clubEvents]
      if (cachedHackathonsRes.success && cachedHackathonsRes.hackathons?.length) {
        combined = [...combined, ...cachedHackathonsRes.hackathons]
        setHackathons(combined)
        setLoading(false)
      }

      if (forceRefresh) {
        try {
          const fresh = await hackathonAPI.getAll({ refresh: true })
          if (fresh.success) {
            setHackathons([...clubEvents, ...(fresh.hackathons || [])])
          }
        } catch {
          // Fallback
        }
      }

      if (!cachedHackathonsRes.success && !forceRefresh) {
        setError('Failed to load hackathons')
        addToast('Failed to load hackathons', 'error')
      }
    } catch (err) {
      const errorMessage = err?.message || 'Failed to load hackathons'
      setError(errorMessage)
      addToast(errorMessage, 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  const loadBookmarks = useCallback(async () => {
    try {
      const response = await hackathonAPI.getUserBookmarks()
      if (response.success) {
        const bookmarkIds = response.hackathons?.map((h) => h._id) || []
        setBookmarks(bookmarkIds)
      }
    } catch {
      /* optional */
    }
  }, [])

  useEffect(() => {
    loadHackathons(true)
    loadBookmarks()
  }, [])

  useEffect(() => {
    const onHackathonsChanged = () => {
      clearHackathonListCache()
      loadHackathons(true)
    }
    window.addEventListener('hackathons-changed', onHackathonsChanged)
    return () => window.removeEventListener('hackathons-changed', onHackathonsChanged)
  }, [loadHackathons])

  const bookmarkedSet = useMemo(() => new Set(bookmarks), [bookmarks])

  const dedupedHackathons = useMemo(() => {
    const seen = new Set()
    return hackathons.filter((hackathon) => {
      const key = getHackathonKey(hackathon)
      if (!key) return false
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [hackathons])

  const gndecHackathons = useMemo(() => {
    return dedupedHackathons.filter((h) => Boolean(h.isCollegeFeatured) || Boolean(h.clubName) || h.tags?.includes('Campus Event'))
  }, [dedupedHackathons])

  const availableClubs = useMemo(() => {
    const clubs = new Set()
    gndecHackathons.forEach((h) => {
      if (h.clubName) clubs.add(h.clubName)
      if (h.organizer) clubs.add(h.organizer)
    })
    return ['All', ...Array.from(clubs)]
  }, [gndecHackathons])

  const filteredHackathons = useMemo(() => {
    let filtered =
      viewMode === 'saved'
        ? dedupedHackathons.filter((h) => bookmarkedSet.has(h._id))
        : dedupedHackathons

    if (scopeFilter === 'GNDEC') {
      filtered = filtered.filter((h) => Boolean(h.isCollegeFeatured) || Boolean(h.clubName) || h.tags?.includes('Campus Event'))

      if (selectedClub !== 'All') {
        filtered = filtered.filter(
          (h) =>
            h.clubName === selectedClub ||
            h.organizer === selectedClub ||
            h.tags?.includes(selectedClub)
        )
      }
    }

    if (modeFilter !== 'All') {
      filtered = filtered.filter((h) => h.mode === modeFilter)
    }

    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.toLowerCase()
      filtered = filtered.filter(
        (h) =>
          String(h.title || '').toLowerCase().includes(query) ||
          String(h.description || '').toLowerCase().includes(query) ||
          String(h.organizer || '').toLowerCase().includes(query) ||
          String(h.clubName || '').toLowerCase().includes(query) ||
          String(h.location || '').toLowerCase().includes(query) ||
          h.tags?.some((tag) => String(tag || '').toLowerCase().includes(query))
      )
    }

    filtered = [...filtered].sort((a, b) => {
      const aCollege = a.isCollegeFeatured || a.clubName ? 0 : 1
      const bCollege = b.isCollegeFeatured || b.clubName ? 0 : 1
      if (aCollege !== bCollege) return aCollege - bCollege
      const aEnded = isEnded(a) ? 1 : 0
      const bEnded = isEnded(b) ? 1 : 0
      if (aEnded !== bEnded) return aEnded - bEnded
      return new Date(a.startDate) - new Date(b.startDate)
    })
    return filtered
  }, [dedupedHackathons, deferredSearchQuery, modeFilter, scopeFilter, selectedClub, bookmarkedSet, viewMode])

  const toggleBookmark = async (hackathonId) => {
    try {
      if (bookmarks.includes(hackathonId)) {
        const response = await hackathonAPI.removeBookmark(hackathonId)
        if (response.success) {
          setBookmarks((prev) => prev.filter((id) => id !== hackathonId))
          addToast('Bookmark removed', 'success')
        }
      } else {
        const response = await hackathonAPI.addBookmark(hackathonId)
        if (response.success) {
          setBookmarks((prev) => [...prev, hackathonId])
          addToast('Hackathon saved!', 'success')
        }
      }
    } catch (err) {
      addToast(err?.message || 'Failed to update bookmark', 'error')
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'TBA'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getStatusBadge = (hackathon) => {
    const now = new Date()
    const start = new Date(hackathon.startDate)
    const end = new Date(hackathon.endDate || hackathon.startDate)

    if (!isNaN(start.getTime()) && now < start) return { text: 'Upcoming', color: 'bg-blue-500/20 text-blue-400' }
    if (!isNaN(end.getTime()) && now > end) return { text: 'Ended', color: 'bg-gray-500/20 text-gray-400' }
    return { text: 'Ongoing', color: 'bg-green-500/20 text-green-400' }
  }

  return (
    <m.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="min-h-screen bg-[#09090b]"
    >
      <div className="flex flex-col lg:flex-row gap-8 max-w-[1280px] mx-auto min-h-[calc(100vh-140px)] pt-8 px-4 sm:px-8 pb-28 md:pb-12">
        
        {/* LEFT SIDEBAR (Standardized uniform controls) */}
        <div className="hidden lg:flex w-[260px] shrink-0 flex-col gap-6 sticky top-28 self-start">
          <div>
            <h3 className="text-3xl font-black text-white uppercase tracking-tight">Hackathons & Events</h3>
            <p className="text-xs text-white/45 leading-relaxed mt-2">
              Explore upcoming club activities, college events and global hackathons.
            </p>
          </div>

          {/* Scope Filter Pill */}
          <div className="p-1 rounded-2xl bg-[#121218] border border-white/10 flex">
            <button
              type="button"
              onClick={() => {
                setScopeFilter('All')
                setSelectedClub('All')
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                scopeFilter === 'All'
                  ? 'bg-[#7c3aed] text-white shadow-md'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              Global
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter('GNDEC')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                scopeFilter === 'GNDEC'
                  ? 'bg-[#a855f7] text-white shadow-md'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              GNDEC ({gndecHackathons.length})
            </button>
          </div>

          {/* Club Dropdown (visible when GNDEC selected) */}
          {scopeFilter === 'GNDEC' && availableClubs.length > 1 && (
            <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
              <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">
                Club / Society
              </label>
              <select
                value={selectedClub}
                onChange={(e) => setSelectedClub(e.target.value)}
                className="w-full bg-[#121218] border border-white/15 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-[#a855f7]"
              >
                {availableClubs.map((club) => (
                  <option key={club} value={club}>
                    {club === 'All' ? 'All Societies & Depts' : club}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Mode Navigation */}
          <div className="p-3 rounded-2xl border border-white/5 bg-white/[0.02]">
            <p className="px-3 pb-2 text-[10px] font-black text-white/30 uppercase tracking-widest">Mode</p>
            <div className="flex flex-col gap-1">
              {['All', 'Online', 'Offline', 'Hybrid'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setModeFilter(mode)}
                  className={`px-4 py-2.5 rounded-xl text-left font-bold text-xs transition-all ${
                    modeFilter === mode
                      ? 'bg-white/10 text-white'
                      : 'text-white/45 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* View Tab */}
          <div className="p-3 rounded-2xl border border-white/5 bg-white/[0.02]">
            <p className="px-3 pb-2 text-[10px] font-black text-white/30 uppercase tracking-widest">Saved Items</p>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setViewMode('browse')}
                className={`px-4 py-2.5 rounded-xl text-left font-bold text-xs transition-all ${
                  viewMode === 'browse'
                    ? 'bg-white/10 text-white'
                    : 'text-white/45 hover:bg-white/5 hover:text-white'
                }`}
              >
                All Events
              </button>
              <button
                type="button"
                onClick={() => setViewMode('saved')}
                className={`px-4 py-2.5 rounded-xl text-left font-bold text-xs transition-all ${
                  viewMode === 'saved'
                    ? 'bg-white/10 text-white'
                    : 'text-white/45 hover:bg-white/5 hover:text-white'
                }`}
              >
                Saved ({bookmarks.length})
              </button>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 w-full">
          <m.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* SEARCH AND MOBILE TABS */}
            <div className="mb-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search hackathons, clubs, venues..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3.5 pl-12 pr-10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7c3aed] transition-all"
                />
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                )}
              </div>

              {/* Mobile Scope & Mode Controls */}
              <div className="flex lg:hidden gap-2">
                <button
                  type="button"
                  onClick={() => setScopeFilter(scopeFilter === 'GNDEC' ? 'All' : 'GNDEC')}
                  className={`flex-1 py-3 px-4 rounded-2xl text-xs font-bold border ${
                    scopeFilter === 'GNDEC'
                      ? 'bg-[#a855f7] border-[#a855f7] text-white'
                      : 'bg-white/[0.03] border-white/10 text-white/70'
                  }`}
                >
                  {scopeFilter === 'GNDEC' ? 'GNDEC Events' : 'All Events'}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === 'saved' ? 'browse' : 'saved')}
                  className={`shrink-0 px-4 py-3 rounded-2xl text-xs font-bold border ${
                    viewMode === 'saved'
                      ? 'bg-[#7c3aed] border-[#7c3aed] text-white'
                      : 'bg-white/[0.03] border-white/10 text-white/70'
                  }`}
                >
                  Saved ({bookmarks.length})
                </button>
              </div>
            </div>

            {/* UNIFORM GRID */}
            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-[340px] rounded-3xl border border-white/10 bg-white/[0.02] animate-pulse" />
                ))}
              </div>
            )}

            {error && !loading && (
              <div className="p-6 rounded-2xl border bg-red-950/20 border-red-900 text-red-400">
                <p className="font-medium">{error}</p>
                <button
                  onClick={() => loadHackathons(true)}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}

            {!loading && filteredHackathons.length === 0 && !error && (
              <div className="text-center py-20 text-white/40">
                <p className="text-lg font-bold mb-1">No hackathons found</p>
                <p className="text-xs">Try adjusting your search terms or scope filters.</p>
              </div>
            )}

            {!loading && filteredHackathons.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredHackathons.map((hackathon, idx) => (
                  <UniformCard
                    key={hackathon._id || hackathon.sourceKey || idx}
                    hackathon={hackathon}
                    idx={idx}
                    isBookmarked={bookmarkedSet.has(hackathon._id)}
                    getStatusBadge={getStatusBadge}
                    formatDate={formatDate}
                    toggleBookmark={toggleBookmark}
                    onSelect={setSelectedHackathon}
                  />
                ))}
              </div>
            )}
          </m.div>
        </div>
      </div>

      {/* DETAILED MODAL */}
      {selectedHackathon && (
        <>
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedHackathon(null)}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md"
          />
          <m.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-[80px] pb-[100px] md:py-12 pointer-events-none"
          >
            <div
              className="pointer-events-auto rounded-3xl w-full md:max-w-2xl max-h-full md:max-h-[85vh] flex flex-col overflow-hidden border border-white/10 bg-[#0d0d12] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 sm:p-6 border-b border-white/10 bg-[#0d0d12] flex justify-between items-center shrink-0">
                <h2 className="text-xl sm:text-2xl font-black text-white line-clamp-1 pr-4">
                  {selectedHackathon.title}
                </h2>
                <button
                  type="button"
                  onClick={() => setSelectedHackathon(null)}
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0"
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 sm:p-6 text-white">
                <div className="h-44 sm:h-52 overflow-hidden rounded-2xl mb-5 relative">
                  <img
                    src={selectedHackathon.image || getFallbackImage('Startups', selectedHackathon.title, selectedHackathon._id, 0)}
                    alt={selectedHackathon.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.onerror = null
                      e.currentTarget.src = getFallbackImage('Startups', selectedHackathon.title, selectedHackathon._id, 0)
                    }}
                  />
                </div>

                <div className="mb-6">
                  <p className={`text-sm text-white/70 leading-relaxed ${!isExpanded ? 'line-clamp-3' : ''}`}>
                    {selectedHackathon.description}
                  </p>
                  {selectedHackathon.description && selectedHackathon.description.length > 180 && (
                    <button
                      type="button"
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="mt-1 text-xs font-bold text-[#a855f7] hover:text-[#c084fc] transition-colors focus:outline-none"
                    >
                      {isExpanded ? 'Show Less' : 'Show More'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-0.5">Venue / Location</p>
                    <p className="font-bold text-xs text-white">{selectedHackathon.location || selectedHackathon.venue || '-'}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-0.5">Mode</p>
                    <p className="font-bold text-xs text-white">{selectedHackathon.mode}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-0.5">Organizer / Club</p>
                    <p className="font-bold text-xs text-white">{selectedHackathon.organizer || selectedHackathon.clubName || 'TBA'}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-0.5">Start Date</p>
                    <p className="font-bold text-xs text-white">{formatDate(selectedHackathon.startDate)}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 col-span-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-0.5">Prize Pool</p>
                    <p className="font-bold text-xs text-[#a855f7]">{selectedHackathon.prize || 'Not specified'}</p>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6 border-t border-white/10 bg-[#0d0d12] shrink-0 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedHackathon(null)}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  Close
                </button>
                {selectedHackathon.registrationLink && (
                  <a
                    href={selectedHackathon.registrationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 rounded-xl font-bold text-xs text-white text-center bg-[#7c3aed] hover:bg-[#6d28d9] transition-all shadow-[0_4px_14px_rgba(124,58,237,0.35)]"
                  >
                    Register Now
                  </a>
                )}
              </div>
            </div>
          </m.div>
        </>
      )}
    </m.div>
  )
}