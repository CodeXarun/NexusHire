'use client'

import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navbar } from '@/components/Navbar'
import { Search, Loader2, User, MapPin, Zap, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { scoreColor, scoreBg } from '@/lib/utils'

interface CandidateResult {
  _id: string
  userId: string
  name?: string
  email?: string
  image?: string
  headline?: string
  location?: string
  skills?: Array<{ skill: string; proficiency: string }>
  profileStrength?: number
  _matchScore?: number
}

export default function RecruiterCandidatesPage() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const debounceTimer = useRef<NodeJS.Timeout>()

  function handleSearch(val: string) {
    setQuery(val)
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebouncedQuery(val), 400)
  }

  const { data: candidates, isLoading } = useQuery<CandidateResult[]>({
    queryKey: ['recruiter-candidates', debouncedQuery],
    queryFn: () =>
      fetch(`/api/recruiter/candidates${debouncedQuery ? `?q=${encodeURIComponent(debouncedQuery)}` : ''}`).then((r) => r.json()),
  })

  const results = Array.isArray(candidates) ? candidates : []

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Link href="/recruiter/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold">Candidate Search</h1>
          <p className="text-muted-foreground mt-1">Search candidates using natural language — AI finds the best matches.</p>
        </div>

        {/* Search bar */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="e.g. Senior React developer with Node.js and 5+ years experience"
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>
        ) : results.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <User className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>{debouncedQuery ? 'No candidates found. Try a different query.' : 'Start typing to search candidates.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">{results.length} candidates found</p>
            {results.map((c) => (
              <div key={c._id} className="glass rounded-2xl p-5 glow-hover transition-all hover:bg-white/8">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  {c.image ? (
                    <img src={c.image} alt="" className="h-12 w-12 rounded-full shrink-0" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-violet-600/30 flex items-center justify-center text-lg font-bold text-violet-400 shrink-0">
                      {c.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{c.name || 'Anonymous'}</h3>
                        {c.headline && <p className="text-sm text-muted-foreground mt-0.5">{c.headline}</p>}
                        {c.location && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {c.location}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {c._matchScore !== undefined && c._matchScore > 0 && (
                          <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${scoreBg(c._matchScore)} ${scoreColor(c._matchScore)}`}>
                            <Zap className="h-3 w-3" />
                            {c._matchScore}% match
                          </span>
                        )}
                        {c.profileStrength !== undefined && (
                          <span className="text-xs text-muted-foreground">{c.profileStrength}% profile</span>
                        )}
                      </div>
                    </div>

                    {/* Top skills */}
                    {c.skills && c.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {c.skills.slice(0, 8).map((s, i) => (
                          <span
                            key={i}
                            className="rounded-lg bg-white/8 px-2.5 py-1 text-xs text-muted-foreground"
                          >
                            {s.skill}
                          </span>
                        ))}
                        {c.skills.length > 8 && (
                          <span className="text-xs text-muted-foreground py-1">+{c.skills.length - 8} more</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
