import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { useToast } from '../context/ToastContext'
import { getFallbackImage } from '../utils/imageUtils'
import Navbar from '../components/Navbar'

const normalizeKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

// Stable id so saved jobs survive reloads (backend may send random ids)
const getStableJobId = (job) => {
  if (!job) return ''
  const link = String(job.applyLink || '').trim()
  if (link && link !== '#') return `link:${normalizeKey(link)}`
  return `${normalizeKey(job.title)}|${normalizeKey(job.company)}`
}

const getJobKey = (job) => {
  if (!job) return ''
  if (job._id) return String(job._id)
  return getStableJobId(job)
}

const SAVED_JOBS_KEY = 'techplus_saved_jobs'

const readSavedJobs = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_JOBS_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function JobGrid({
  jobs,
  bookmarkedSet,
  isDark,
  toggleBookmark,
  onSelect,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
      {jobs.map((job, idx) => {
        const isBookmarked = bookmarkedSet.has(job._id)

        return (
          <m.div
            key={job._id || job.applyLink || idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.03, 0.3), duration: 0.3 }}
            onClick={() => onSelect(job)}
            className={`group rounded-3xl border overflow-hidden transition-all duration-300 hover:-translate-y-1 cursor-pointer ${
              isDark
                ? 'bg-white/[0.025] border-white/10 hover:border-[#7c3aed]/70 hover:shadow-[0_20px_40px_rgba(0,0,0,0.45)]'
                : 'bg-white border-gray-200 hover:border-blue-500'
            }`}
          >
            <div className="h-40 sm:h-44 overflow-hidden bg-gradient-to-br from-[#7c3aed]/20 to-[#3b82f6]/20 relative">
              <img
                src={job.image || getFallbackImage('Startups', job.title, job._id, 0)}
                alt={job.title}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={(e) => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = getFallbackImage('Startups', job.title, job._id, 0)
                }}
              />
            </div>

            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3 gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-medium shrink-0 bg-purple-500/20 text-purple-300">
                  {job.type || 'Full-Time'}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleBookmark(job)
                  }}
                  className={`px-3 py-1 rounded-full transition-colors text-[11px] font-bold tracking-wide ${
                    isBookmarked
                      ? 'bg-yellow-500/20 text-yellow-300'
                      : isDark
                      ? 'bg-white/10 text-white/70 hover:text-white'
                      : 'bg-gray-200 text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {isBookmarked ? 'SAVED' : 'SAVE'}
                </button>
              </div>

              <h3 className={`text-[17px] sm:text-xl font-black tracking-tight mb-1 line-clamp-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {job.title}
              </h3>

              <p className="text-xs font-bold text-[#a855f7] mb-3">{job.company}</p>

              <div className="space-y-2 mb-4 text-xs">
                <div className={`flex items-center gap-2 ${isDark ? 'text-white/55' : 'text-gray-600'}`}>
                  <span className="font-bold">LOCATION</span>
                  <span>{job.location || 'Remote'}</span>
                </div>
                <div className={`flex items-center gap-2 ${isDark ? 'text-white/55' : 'text-gray-600'}`}>
                  <span className="font-bold">TYPE</span>
                  <span>{job.type || 'Full-Time'}</span>
                </div>
              </div>

              {job.applyLink && (
                <a
                  href={job.applyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="w-full mt-2 inline-flex items-center justify-center px-4 py-2 bg-[#7c3aed] text-white rounded-xl font-bold text-xs hover:bg-[#6d28d9] transition-colors"
                >
                  Apply Now
                </a>
              )}
            </div>
          </m.div>
        )
      })}
    </div>
  )
}

export default function JobBoard() {
  const { addToast } = useToast()
  const isDark = true

  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Saved jobs persist in localStorage (full job objects)
  const [savedJobs, setSavedJobs] = useState(readSavedJobs)
  const bookmarks = useMemo(() => savedJobs.map((j) => j._id), [savedJobs])

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_JOBS_KEY, JSON.stringify(savedJobs))
    } catch {
      /* storage unavailable */
    }
  }, [savedJobs])

  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [typeFilter, setTypeFilter] = useState('All')
  const [viewMode, setViewMode] = useState('browse')
  const [selectedJob, setSelectedJob] = useState(null)
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false)

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'

      // Force fresh fetch to bypass 304 browser cache
      const res = await fetch(`${apiUrl}/api/jobs`, { cache: 'no-store' })
      const data = await res.json()

      if (Array.isArray(data)) {
        // Replace unstable ids with stable ones
        setJobs(data.map((job) => ({ ...job, _id: getStableJobId(job) })))
      } else {
        setJobs([])
      }
    } catch (err) {
      setError(err?.message || 'Failed to load jobs')
      addToast(err?.message || 'Failed to load jobs', 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  const bookmarkedSet = useMemo(() => new Set(bookmarks), [bookmarks])

  const dedupedJobs = useMemo(() => {
    const seen = new Set()
    return jobs.filter((job) => {
      const key = getJobKey(job)
      if (!key) return false
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [jobs])

  const filteredJobs = useMemo(() => {
    let filtered = viewMode === 'saved' ? savedJobs : dedupedJobs

    if (typeFilter !== 'All') {
      filtered = filtered.filter((j) => String(j.type || '').toLowerCase().includes(typeFilter.toLowerCase()))
    }

    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.toLowerCase()
      filtered = filtered.filter(
        (j) =>
          String(j.title || '').toLowerCase().includes(query) ||
          String(j.company || '').toLowerCase().includes(query) ||
          String(j.location || '').toLowerCase().includes(query)
      )
    }

    return filtered
  }, [dedupedJobs, savedJobs, deferredSearchQuery, typeFilter, viewMode])

  const toggleBookmark = (job) => {
    const exists = bookmarkedSet.has(job._id)
    setSavedJobs((prev) =>
      exists ? prev.filter((j) => j._id !== job._id) : [...prev, job]
    )
    addToast(
      exists ? 'Job removed from saved list' : 'Job saved!',
      exists ? 'info' : 'success'
    )
  }

  return (
    <m.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`min-h-screen ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'}`}
    >
      <Navbar />
      <div className="flex flex-col lg:flex-row gap-8 max-w-[1100px] mx-auto min-h-[calc(100vh-140px)] relative z-10 pt-8 px-[4px] sm:px-6 pb-28 md:pb-12">
        {/* Desktop Sidebar Filters */}
        <div className="hidden lg:flex w-full lg:w-[320px] shrink-0 flex-col gap-4 lg:sticky lg:top-28 lg:self-start lg:max-h-[calc(100vh-160px)] lg:overflow-auto">
          <div className="p-6 rounded-3xl border border-white/5 bg-white/[0.02]">
            <h2 className="text-[10px] font-black text-[#a855f7] uppercase tracking-[0.2em] mb-3">Careers</h2>
            <h3 className="text-3xl font-black text-white uppercase tracking-tight mb-2">Job Board</h3>
            <p className="text-sm text-white/45 leading-relaxed">Discover live tech positions, apply directly, and save top listings.</p>
          </div>

          <div className="p-3 rounded-3xl border border-white/5" style={{ background: 'var(--bg-surface)' }}>
            <p className="px-3 pb-2 text-[10px] font-black text-white/30 uppercase tracking-widest">Type Filter</p>
            <div className="flex flex-col gap-2">
              {['All', 'Full-time', 'Part-time', 'Contract'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(type)}
                  className={`px-4 py-3 rounded-2xl text-left font-bold text-sm transition-all relative overflow-hidden group ${
                    typeFilter === type
                      ? 'text-white'
                      : 'text-white/45 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {typeFilter === type && (
                    <m.div
                      layoutId="type-pill"
                      className="absolute inset-0 bg-[#7c3aed] shadow-[0_4px_20px_rgba(124,58,237,0.4)]"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-10">{type}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-3xl border border-white/5" style={{ background: 'var(--bg-surface)' }}>
            <p className="px-3 pb-2 text-[10px] font-black text-white/30 uppercase tracking-widest">View</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setViewMode('browse')}
                className={`px-4 py-3 rounded-2xl text-left font-bold text-sm transition-all relative overflow-hidden group ${
                  viewMode === 'browse'
                    ? 'text-white'
                    : 'text-white/45 hover:bg-white/5 hover:text-white'
                }`}
              >
                {viewMode === 'browse' && (
                  <m.div
                    layoutId="view-pill"
                    className="absolute inset-0 bg-[#7c3aed] shadow-[0_4px_20px_rgba(124,58,237,0.4)]"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10">Browse</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('saved')}
                className={`px-4 py-3 rounded-2xl text-left font-bold text-sm transition-all relative overflow-hidden group ${
                  viewMode === 'saved'
                    ? 'text-white'
                    : 'text-white/45 hover:bg-white/5 hover:text-white'
                }`}
              >
                {viewMode === 'saved' && (
                  <m.div
                    layoutId="view-pill"
                    className="absolute inset-0 bg-[#7c3aed] shadow-[0_4px_20px_rgba(124,58,237,0.4)]"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10">Saved ({bookmarks.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 w-full min-h-[500px]">
          <m.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div className="mb-6 pb-6 md:mb-10 md:pb-8 border-b border-white/5">
              <div className="lg:hidden mb-4 flex flex-col gap-2 px-2">
                <h2 className="text-[10px] font-black text-[#a855f7] uppercase tracking-[0.2em]">Careers</h2>
                <h3 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Job Board</h3>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 max-w-xl">
                <div className="relative flex-1 group">
                  <input
                    type="text"
                    placeholder="Search jobs, roles, companies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3.5 pl-12 pr-10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] transition-all"
                  />
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[#a855f7] transition-colors">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setViewMode(viewMode === 'saved' ? 'browse' : 'saved')}
                  className={`lg:hidden shrink-0 w-[44px] h-[44px] sm:w-[50px] sm:h-[50px] flex items-center justify-center rounded-2xl border transition-all ${
                    viewMode === 'saved'
                      ? 'bg-[#7c3aed] border-[#7c3aed] text-white shadow-[0_0_20px_rgba(124,58,237,0.4)]'
                      : 'bg-white/[0.03] border-white/10 text-white/40'
                  }`}
                >
                  <svg width="20" height="20" fill={viewMode === 'saved' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"/>
                  </svg>
                </button>
              </div>

              {/* Mobile Type Filter Dropdown */}
              <div className="lg:hidden mt-4 relative">
                <button
                  type="button"
                  onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                  className="flex items-center justify-between w-full px-4 py-3 bg-white/[0.03] rounded-2xl border border-white/10 text-white transition-all text-sm font-bold"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 uppercase text-[10px] font-black tracking-widest mr-2">Type</span>
                    <span className="text-[#a855f7] px-2 py-0.5 bg-[#a855f7]/10 rounded-lg">{typeFilter}</span>
                  </div>
                  <m.div animate={{ rotate: isTypeDropdownOpen ? 180 : 0 }} transition={{ duration: 0.3 }}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
                  </m.div>
                </button>

                <AnimatePresence>
                  {isTypeDropdownOpen && (
                    <m.div
                      initial={{ opacity: 0, y: -10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#0d0d0f] border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-2"
                    >
                      {['All', 'Full-time', 'Part-time', 'Contract'].map((type) => (
                        <button
                          key={type}
                          onClick={() => {
                            setTypeFilter(type)
                            setIsTypeDropdownOpen(false)
                          }}
                          className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                            typeFilter === type ? 'bg-[#7c3aed] text-white' : 'text-white/40 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </m.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="hidden lg:block mt-6">
                <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">Tech Opportunities</h1>
                <p className="text-base text-white/50 leading-relaxed max-w-2xl">Explore live software, engineering, and tech roles aggregated from leading platforms.</p>
              </div>
            </div>

            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                {[1, 2, 3, 4, 5, 6].map((s) => (
                  <div key={s} className="rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden animate-pulse">
                    <div className="h-44 bg-white/10" />
                    <div className="p-6 space-y-3">
                      <div className="h-4 bg-white/10 rounded w-2/3" />
                      <div className="h-3 bg-white/5 rounded w-full" />
                      <div className="h-3 bg-white/5 rounded w-5/6" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && !loading && (
              <div className="p-6 rounded-lg border bg-red-950/20 border-red-900 text-red-400">
                <p className="font-medium">{error}</p>
                <button onClick={loadJobs} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  Try Again
                </button>
              </div>
            )}

            {!loading && filteredJobs.length === 0 && !error && (
              <div className="text-center py-16 text-slate-400">
                <p className="text-lg font-bold mb-2">
                  {viewMode === 'saved' ? 'No saved jobs yet' : 'No jobs available'}
                </p>
                <p className="text-sm">
                  {viewMode === 'saved'
                    ? 'Tap SAVE on any job and it will show up here.'
                    : 'Try adjusting your search queries or active filters.'}
                </p>
              </div>
            )}

            {!loading && filteredJobs.length > 0 && (
              <JobGrid
                jobs={filteredJobs}
                bookmarkedSet={bookmarkedSet}
                isDark={isDark}
                toggleBookmark={toggleBookmark}
                onSelect={setSelectedJob}
              />
            )}
          </m.div>
        </div>
      </div>

      {/* Selected Job Modal Preview */}
      {selectedJob && (
        <>
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedJob(null)}
            className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm"
          />
          <m.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-[80px] pb-[100px] md:py-12 pointer-events-none"
          >
            <div
              className="pointer-events-auto rounded-3xl w-full md:max-w-2xl max-h-full md:max-h-[80vh] flex flex-col overflow-hidden border border-[#ececf4] bg-[#f7f7fb] shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 sm:p-6 border-b border-gray-200/60 bg-[#f7f7fb] flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-[#111827] line-clamp-1 pr-4">
                    {selectedJob.title}
                  </h2>
                  <p className="text-sm font-bold text-[#7c3aed]">{selectedJob.company}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="w-9 h-9 rounded-full bg-[#ececf4] hover:bg-[#dedfee] text-[#4b5563] flex items-center justify-center transition-colors shrink-0"
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar-dark p-5 sm:p-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-xl bg-[#ececf4]">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7280] mb-0.5">Location</p>
                    <p className="font-bold text-sm text-[#111827]">{selectedJob.location || 'Remote'}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#ececf4]">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7280] mb-0.5">Job Type</p>
                    <p className="font-bold text-sm text-[#111827]">{selectedJob.type || 'Full-time'}</p>
                  </div>
                </div>

                <a
                  href={selectedJob.applyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center px-6 py-3.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-2xl font-black text-sm tracking-wide transition-colors"
                >
                  Apply Directly
                </a>
              </div>
            </div>
          </m.div>
        </>
      )}
    </m.div>
  )
}