'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Navbar } from '@/components/Navbar'
import Link from 'next/link'
import { Loader2, Zap, ChevronRight, CheckCircle, XCircle, MinusCircle, Lightbulb, Trash2 } from 'lucide-react'
import { scoreColor, scoreBg, timeAgo } from '@/lib/utils'
import Pusher from 'pusher-js'
import { toast } from 'sonner'

const STAGES = ['applied', 'under_review', 'shortlisted', 'interview', 'decision', 'outcome']
const STAGE_LABELS: Record<string, string> = {
  applied: 'Applied',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  decision: 'Decision',
  outcome: 'Outcome',
}

interface SkillBreakdown { skill: string; match: 'full' | 'partial' | 'none'; weight: number }

interface Application {
  _id: string
  stage: string
  outcome?: string | null
  matchScore: { overall: number; skillsMatch: number; experienceMatch: number; explanation?: string }
  breakdown?: SkillBreakdown[]
  percentileRank: number
  createdAt: string
  updatedAt?: string
  stageHistory?: Array<{ stage: string; timestamp: string; note: string }>
  job?: { _id: string; title: string; companyName: string; location: string }
  _stageChanged?: boolean
}

export default function CandidateApplicationsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['applications'],
    queryFn: () => fetch('/api/applications').then((r) => r.json()),
  })

  const [selectedApp, setSelectedApp] = useState<string | null>(null)
  const [pulsing, setPulsing] = useState<Set<string>>(new Set())
  const [explainLoading, setExplainLoading] = useState(false)
  const [explanation, setExplanation] = useState<Record<string, string>>({})

  const apps: Application[] = Array.isArray(data) ? data : []

  const withdraw = useMutation({
    mutationFn: (appId: string) =>
      fetch(`/api/applications/${appId}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => {
      toast.success('Application withdrawn')
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      setSelectedApp(null)
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to withdraw'),
  })

  // Subscribe to Pusher for each application
  useEffect(() => {
    if (!apps.length) return
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER
    if (!pusherKey || !pusherCluster) return

    const pusher = new Pusher(pusherKey, { cluster: pusherCluster })
    const channels = apps.map((app) => {
      const ch = pusher.subscribe(`application-${app._id}`)
      ch.bind('stage-update', (data: { stage: string; applicationId: string }) => {
        toast.info(`Application stage updated to: ${STAGE_LABELS[data.stage] || data.stage}`)
        // Pulse the card
        setPulsing((prev) => new Set(prev).add(data.applicationId))
        setTimeout(() => {
          setPulsing((prev) => { const s = new Set(prev); s.delete(data.applicationId); return s })
        }, 3000)
        refetch()
      })
      return ch
    })

    return () => {
      channels.forEach((ch) => ch.unsubscribe())
      pusher.disconnect()
    }
  }, [apps.length])

  async function fetchExplanation(appId: string) {
    if (explanation[appId]) return
    setExplainLoading(true)
    try {
      const res = await fetch(`/api/ai/explain-match?applicationId=${appId}`)
      const data = await res.json()
      setExplanation((prev) => ({ ...prev, [appId]: data.explanation }))
    } catch {
      toast.error('Failed to load explanation')
    } finally {
      setExplainLoading(false)
    }
  }

  const selected = apps.find((a) => a._id === selectedApp)

  const overall = selected?.matchScore?.overall ?? (selected?.matchScore as unknown as number) ?? 0
  const skillsMatch = selected?.matchScore?.skillsMatch ?? 0
  const experienceMatch = selected?.matchScore?.experienceMatch ?? 0

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-10">
        <h1 className="text-2xl font-bold mb-8">My Applications</h1>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>
        ) : apps.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <p className="text-muted-foreground mb-4">You haven&apos;t applied to any jobs yet.</p>
            <Link href="/jobs" className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors">
              Browse jobs
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Application list */}
            <div className="lg:col-span-2 space-y-3">
              {apps.map((app) => {
                const stageIdx = STAGES.indexOf(app.stage)
                const isRejected = app.stage === 'outcome' && app.outcome === 'rejected'
                const isHired = app.stage === 'outcome' && app.outcome === 'hired'
                const isPulsing = pulsing.has(app._id)
                const appScore = app.matchScore?.overall ?? (app.matchScore as unknown as number) ?? 0

                return (
                  <button
                    key={app._id}
                    onClick={() => setSelectedApp(app._id === selectedApp ? null : app._id)}
                    className={`w-full text-left glass rounded-2xl p-5 transition-all hover:bg-white/8 ${
                      selectedApp === app._id ? 'ring-2 ring-violet-500' : ''
                    } ${isPulsing ? 'ring-2 ring-green-500 animate-pulse' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{app.job?.title || 'Unknown Role'}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{app.job?.companyName}</p>
                        <p className="text-xs text-muted-foreground mt-1">{timeAgo(app.createdAt)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {appScore > 0 && (
                          <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${scoreBg(appScore)} ${scoreColor(appScore)}`}>
                            <Zap className="h-3 w-3" />
                            {appScore}%
                          </span>
                        )}
                        {isRejected && (
                          <span className="text-xs text-red-400 font-medium bg-red-500/10 px-2 py-0.5 rounded-sm">Rejected</span>
                        )}
                        {isHired && (
                          <span className="text-xs text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded-sm uppercase tracking-wide">Hired!</span>
                        )}
                        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${selectedApp === app._id ? 'rotate-90' : ''}`} />
                      </div>
                    </div>

                    {/* Stage tracker */}
                    <div className="mt-4">
                      <div className="flex items-center gap-1">
                        {STAGES.map((s, idx) => (
                          <div key={s} className="flex items-center flex-1">
                            <div className={`h-2 flex-1 rounded-full transition-all ${idx <= stageIdx ? 'bg-violet-600' : 'bg-white/10'}`} />
                          </div>
                        ))}
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {STAGE_LABELS[app.stage]} · {app.percentileRank !== undefined ? `Top ${100 - app.percentileRank}%` : ''}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Detail panel */}
            <div className="lg:col-span-1">
              {selected ? (
                <div className="glass rounded-2xl p-5 sticky top-24 space-y-4 overflow-y-auto max-h-[85vh]">
                  <div>
                    <h2 className="font-semibold mb-0.5">{selected.job?.title}</h2>
                    <p className="text-sm text-muted-foreground">{selected.job?.companyName}</p>
                  </div>

                  {/* Score breakdown */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">Match score</div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: 'Overall', value: overall },
                        { label: 'Skills', value: skillsMatch },
                        { label: 'Exp', value: experienceMatch },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-lg bg-white/5 p-2 text-center">
                          <div className={`text-sm font-bold ${scoreColor(value)}`}>{value}%</div>
                          <div className="text-xs text-muted-foreground">{label}</div>
                        </div>
                      ))}
                    </div>
                    {selected.percentileRank !== undefined && (
                      <p className="text-xs text-muted-foreground">Top {100 - selected.percentileRank}% of applicants</p>
                    )}
                  </div>

                  {/* Per-skill breakdown */}
                  {selected.breakdown && selected.breakdown.length > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-2">Skill breakdown</div>
                      <div className="space-y-1.5">
                        {selected.breakdown.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            {item.match === 'full' ? (
                              <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />
                            ) : item.match === 'partial' ? (
                              <MinusCircle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                            )}
                            <span className={item.match === 'none' ? 'text-muted-foreground' : ''}>{item.skill}</span>
                            {item.weight === 3 && <span className="text-muted-foreground ml-auto">req</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Explanation */}
                  <div>
                    {explanation[selected._id] ? (
                      <div className="rounded-xl border border-violet-500/20 bg-violet-500/8 p-3 text-xs text-muted-foreground leading-relaxed">
                        <div className="flex items-center gap-1.5 mb-1.5 text-violet-300 font-medium">
                          <Lightbulb className="h-3.5 w-3.5" /> Why this score?
                        </div>
                        {explanation[selected._id]}
                      </div>
                    ) : (
                      <button
                        onClick={() => fetchExplanation(selected._id)}
                        disabled={explainLoading}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/8 px-3 py-2 text-xs text-violet-300 hover:bg-violet-500/15 transition-colors disabled:opacity-50"
                      >
                        {explainLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="h-3.5 w-3.5" />}
                        Why did I match {overall}%?
                      </button>
                    )}
                  </div>

                  {/* Stage history */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">Stage history</div>
                    <div className="space-y-2">
                      {(selected.stageHistory || []).map((h, i) => (
                        <div key={i} className="flex gap-2 text-xs">
                          <div className="mt-1 h-2 w-2 rounded-full bg-violet-500 shrink-0" />
                          <div>
                            <span className="font-medium">{STAGE_LABELS[h.stage] || h.stage}</span>
                            {h.note && <p className="text-muted-foreground mt-0.5">{h.note}</p>}
                            <p className="text-muted-foreground">{timeAgo(h.timestamp)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Rejection skill gap */}
                  {selected.stage === 'outcome' && selected.outcome === 'rejected' && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/8 p-4 space-y-2">
                      <p className="text-xs text-red-300 font-semibold">Application Rejected</p>
                      <p className="text-xs text-muted-foreground">Get AI-powered feedback using recruiter notes &amp; comparison to selected candidates.</p>
                      <Link
                        href={`/candidate/skill-gap?applicationId=${selected._id}&rejected=true`}
                        className="block w-full rounded-lg bg-red-500/20 px-3 py-2 text-center text-xs text-red-300 hover:bg-red-500/30 transition-colors font-medium"
                      >
                        ✦ AI Rejection Analysis
                      </Link>
                      <Link
                        href={`/candidate/skill-gap?applicationId=${selected._id}`}
                        className="block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-xs text-muted-foreground hover:bg-white/10 transition-colors"
                      >
                        JD Skill Gap &amp; Learning Path
                      </Link>
                    </div>
                  )}

                  {/* Hired notification */}
                  {selected.stage === 'outcome' && selected.outcome === 'hired' && (
                    <div className="rounded-xl border border-green-500/30 bg-green-500/8 p-4 space-y-2 text-center">
                      <p className="text-sm text-green-400 font-bold uppercase tracking-widest">You're Hired! 🎉</p>
                      <p className="text-xs text-muted-foreground pb-2">Congratulations! The recruiter has selected you for this role.</p>
                      <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="space-y-2">
                    <Link
                      href={`/candidate/interview?jobId=${selected.job?._id}`}
                      className="block w-full rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-center text-sm text-violet-300 hover:bg-violet-500/20 transition-colors"
                    >
                      Practice interview
                    </Link>
                    <Link
                      href={`/candidate/skill-gap?applicationId=${selected._id}`}
                      className="block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-center text-sm text-muted-foreground hover:bg-white/10 transition-colors"
                    >
                      Skill gap analysis
                    </Link>
                    {!['decision', 'outcome'].includes(selected.stage) && (
                      <button
                        onClick={() => {
                          if (confirm('Withdraw this application?')) withdraw.mutate(selected._id)
                        }}
                        disabled={withdraw.isPending}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-2 text-sm text-red-400 hover:bg-red-500/15 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Withdraw application
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
                  Select an application to see details
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
