'use client'

import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navbar } from '@/components/Navbar'
import { JobCard } from '@/components/JobCard'
import { Search, Loader2, SlidersHorizontal, X } from 'lucide-react'

const MATCH_TIERS = [
  { label: 'All', min: 0 },
  { label: '60%+', min: 60 },
  { label: '70%+', min: 70 },
  { label: '80%+', min: 80 },
]

export default function JobsPage() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [matchTier, setMatchTier] = useState(0)
  const [locationType, setLocationType] = useState('')
  const [roleLevel, setRoleLevel] = useState('')
  const debounceTimer = useRef<NodeJS.Timeout>()

  function handleSearch(val: string) {
    setQuery(val)
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(val)
      setPage(1)
    }, 400)
  }

  const filterParams = new URLSearchParams()
  if (locationType) filterParams.set('locationType', locationType)
  if (roleLevel) filterParams.set('roleLevel', roleLevel)
  const filterStr = filterParams.toString()

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', debouncedQuery, page, locationType, roleLevel],
    queryFn: async () => {
      const url = debouncedQuery
        ? `/api/jobs/search?q=${encodeURIComponent(debouncedQuery)}&page=${page}${filterStr ? `&${filterStr}` : ''}`
        : `/api/jobs?page=${page}&limit=12${filterStr ? `&${filterStr}` : ''}`
      return fetch(url).then((r) => r.json())
    },
  })

  const allJobs = data?.jobs || []
  // Apply match tier filter client-side (only works when _matchScore is present)
  const jobs = matchTier > 0
    ? allJobs.filter((j: { _matchScore?: number }) => (j._matchScore ?? 0) >= matchTier)
    : allJobs
  const total = data?.total || 0
  const hasActiveFilters = locationType || roleLevel || matchTier > 0

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Find your next role</h1>
          <p className="mt-2 text-muted-foreground">Search with natural language — AI understands your intent.</p>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="e.g. Senior React developer remote, $120k+"
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-14 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-violet-600 text-white'
                : 'bg-white/10 text-muted-foreground hover:bg-white/15'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters{hasActiveFilters ? ' ●' : ''}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mb-6 glass rounded-xl p-4 flex flex-wrap gap-6">
            {/* Match tier */}
            <div>
              <label className="block text-xs text-muted-foreground mb-2">Match tier</label>
              <div className="flex gap-2">
                {MATCH_TIERS.map((t) => (
                  <button
                    key={t.min}
                    onClick={() => setMatchTier(t.min)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                      matchTier === t.min
                        ? 'border-violet-500 bg-violet-500/15 text-violet-300'
                        : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Work type */}
            <div>
              <label className="block text-xs text-muted-foreground mb-2">Work type</label>
              <div className="flex gap-2">
                {['', 'remote', 'hybrid', 'onsite'].map((v) => (
                  <button
                    key={v}
                    onClick={() => setLocationType(v)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                      locationType === v
                        ? 'border-violet-500 bg-violet-500/15 text-violet-300'
                        : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
                    }`}
                  >
                    {v || 'Any'}
                  </button>
                ))}
              </div>
            </div>

            {/* Level */}
            <div>
              <label className="block text-xs text-muted-foreground mb-2">Level</label>
              <div className="flex gap-2">
                {['', 'junior', 'mid', 'senior', 'lead'].map((v) => (
                  <button
                    key={v}
                    onClick={() => setRoleLevel(v)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                      roleLevel === v
                        ? 'border-violet-500 bg-violet-500/15 text-violet-300'
                        : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
                    }`}
                  >
                    {v || 'Any'}
                  </button>
                ))}
              </div>
            </div>

            {hasActiveFilters && (
              <button
                onClick={() => { setMatchTier(0); setLocationType(''); setRoleLevel('') }}
                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors self-end"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <p>No jobs found. Try a different search or adjust filters.</p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">{total} jobs found</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {jobs.map((job: Parameters<typeof JobCard>[0]['job']) => (
                <JobCard key={job._id} job={job} href={`/jobs/${job._id}`} />
              ))}
            </div>

            {/* Pagination */}
            {data?.pages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm disabled:opacity-30 hover:bg-white/5 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-muted-foreground">Page {page} of {data.pages}</span>
                <button
                  disabled={page === data.pages}
                  onClick={() => setPage(page + 1)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm disabled:opacity-30 hover:bg-white/5 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
