'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Navbar } from '@/components/Navbar'
import { OpportunityGraph, JobNode } from '@/components/graph/OpportunityGraph'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Loader2, Zap, MapPin, Briefcase, Clock, ArrowRight,
  Sparkles, CheckCircle, XCircle, AlertTriangle, Filter,
  Bot, X,
} from 'lucide-react'
import { scoreColor, scoreBg, formatSalary } from '@/lib/utils'

// ── Auto-Apply modal ──────────────────────────────────────────────────────────
interface AutoApplyJob extends JobNode {
  status?: 'pending' | 'applying' | 'done' | 'error' | 'duplicate'
}

function AutoApplyModal({
  jobs,
  onClose,
  onComplete,
}: {
  jobs: AutoApplyJob[]
  onClose: () => void
  onComplete: (appliedIds: string[]) => void
}) {
  const [rows, setRows] = useState<AutoApplyJob[]>(jobs)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)

  async function startApply() {
    setRunning(true)
    const appliedIds: string[] = []

    for (let i = 0; i < rows.length; i++) {
      setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: 'applying' } : r))

      try {
        const res = await fetch('/api/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: rows[i].id, coverLetter: '' }),
        })
        const data = await res.json()

        if (res.status === 409) {
          setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: 'duplicate' } : r))
        } else if (!res.ok) {
          setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: 'error' } : r))
        } else {
          setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: 'done' } : r))
          appliedIds.push(data._id)
        }
      } catch {
        setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: 'error' } : r))
      }

      // Small delay between applications
      if (i < rows.length - 1) await new Promise((r) => setTimeout(r, 600))
    }

    setRunning(false)
    setDone(true)
    onComplete(appliedIds)
  }

  const successCount = rows.filter((r) => r.status === 'done').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="glass rounded-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-violet-400" />
            <h2 className="text-lg font-bold">Auto-Apply</h2>
          </div>
          {!running && <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground hover:text-foreground" /></button>}
        </div>

        {!done ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Applying to <strong className="text-foreground">{rows.length}</strong> top-matching jobs on your behalf.
              A blank cover letter will be submitted — update them from <Link href="/candidate/applications" className="text-violet-400 hover:underline">My Applications</Link> after.
            </p>

            <div className="space-y-2 mb-5 max-h-64 overflow-y-auto">
              {rows.map((job, i) => (
                <div key={job.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className={`h-2 w-2 rounded-full shrink-0 ${
                    job.status === 'applying' ? 'bg-yellow-400 animate-pulse' :
                    job.status === 'done' ? 'bg-green-400' :
                    job.status === 'error' ? 'bg-red-400' :
                    job.status === 'duplicate' ? 'bg-gray-400' :
                    'bg-white/20'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{job.title}</p>
                    <p className="text-xs text-muted-foreground">{job.companyName}</p>
                  </div>
                  <span className={`text-xs font-bold ${scoreColor(job.score)}`}>{job.score}%</span>
                  <span className="text-xs text-muted-foreground w-16 text-right">
                    {job.status === 'applying' ? <Loader2 className="h-3 w-3 animate-spin inline" /> :
                     job.status === 'done' ? <CheckCircle className="h-3.5 w-3.5 text-green-400 inline" /> :
                     job.status === 'error' ? <XCircle className="h-3.5 w-3.5 text-red-400 inline" /> :
                     job.status === 'duplicate' ? <span className="text-gray-400">Already applied</span> :
                     `#${i + 1}`}
                  </span>
                </div>
              ))}
            </div>

            {!running && (
              <div className="flex gap-3">
                <button
                  onClick={startApply}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
                >
                  <Bot className="h-4 w-4" /> Start applying
                </button>
                <button
                  onClick={onClose}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {running && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-1">
                <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                Submitting applications…
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold mb-1">Done!</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Successfully applied to <strong className="text-foreground">{successCount}</strong> of {rows.length} jobs.
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/candidate/applications"
                className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
              >
                View applications
              </Link>
              <button
                onClick={onClose}
                className="rounded-xl border border-white/10 px-5 py-2.5 text-sm hover:bg-white/5 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OpportunityGraphPage() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  const [selectedJob, setSelectedJob] = useState<JobNode | null>(null)
  const [minScore, setMinScore] = useState(0)
  const [autoApplyJobs, setAutoApplyJobs] = useState<JobNode[] | null>(null)
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())

  const { data: rawJobs, isLoading } = useQuery<JobNode[]>({
    queryKey: ['opportunity-graph'],
    queryFn: () =>
      fetch('/api/candidate/recommendations')
        .then((r) => r.json())
        .then((jobs: Array<Record<string, unknown>>) =>
          jobs.map((j) => ({
            id: String(j._id),
            title: String(j.title || ''),
            companyName: String(j.companyName || ''),
            location: String(j.location || ''),
            score: Number(j._matchScore ?? 0),
            employmentType: String(j.employmentType || ''),
            locationType: String(j.locationType || ''),
            requiredSkills: (j.requiredSkills as JobNode['requiredSkills']) || [],
            salaryRange: j.salaryRange,
          }))
        ),
  })

  const jobs: JobNode[] = useMemo(() => {
    if (!rawJobs) return []
    return rawJobs
      .filter((j) => j.score >= minScore && !appliedIds.has(j.id))
      .sort((a, b) => b.score - a.score)
  }, [rawJobs, minScore, appliedIds])

  function openAutoApply() {
    const top = jobs.slice(0, 5)
    if (!top.length) {
      toast.error('No jobs found. Lower your filter.')
      return
    }
    setAutoApplyJobs(top)
  }

  function handleAutoApplyComplete(ids: string[]) {
    setAppliedIds((prev) => {
      const next = new Set(prev)
      jobs.filter((_, i) => i < 5).forEach((j) => next.add(j.id))
      return next
    })
    queryClient.invalidateQueries({ queryKey: ['applications'] })
    toast.success(`Applied to ${ids.length} jobs!`)
  }

  const scoreDistribution = useMemo(() => {
    if (!jobs.length) return { high: 0, mid: 0, low: 0 }
    return {
      high: jobs.filter((j) => j.score >= 75).length,
      mid: jobs.filter((j) => j.score >= 50 && j.score < 75).length,
      low: jobs.filter((j) => j.score < 50).length,
    }
  }, [jobs])

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-violet-400" />
              Opportunity Graph
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Visual map of your best-fit jobs — node size and color reflect your match score.
            </p>
          </div>

          <button
            onClick={openAutoApply}
            disabled={isLoading || !jobs.length}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-40 transition-colors shrink-0"
          >
            <Bot className="h-4 w-4" />
            Auto-Apply to Top Matches
          </button>
        </div>

        {/* Stats row */}
        {!isLoading && jobs.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Total opportunities', value: jobs.length, color: 'text-foreground' },
              { label: 'Strong match (75%+)', value: scoreDistribution.high, color: 'text-green-400' },
              { label: 'Good match (50–74%)', value: scoreDistribution.mid, color: 'text-amber-400' },
              { label: 'Weak match (<50%)', value: scoreDistribution.low, color: 'text-red-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="glass rounded-xl p-4 text-center">
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filter bar */}
        <div className="mb-4 flex flex-wrap items-center gap-4 glass rounded-xl px-4 py-3">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2 text-sm">
            <label className="text-muted-foreground text-xs">Min match:</label>
            <input
              type="range"
              min={0} max={90} step={5}
              value={minScore}
              onChange={(e) => setMinScore(+e.target.value)}
              className="w-28 accent-violet-600"
            />
            <span className="text-xs font-medium w-8">{minScore}%</span>
          </div>

          {/* Legend */}
          <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full border-2 border-green-500 bg-green-500/20" />
              Strong (75%+)
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full border-2 border-amber-500 bg-amber-500/20" />
              Good (50–74%)
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full border-2 border-red-500 bg-red-500/20" />
              Weak (&lt;50%)
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-full border-2 border-violet-500/40 border-dashed" />
              Skill cluster
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-5">
          {/* Graph */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-[540px] glass rounded-xl gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                <p className="text-sm text-muted-foreground">Building your opportunity map…</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[540px] glass rounded-xl gap-4 text-center px-8">
                <AlertTriangle className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="font-medium mb-1">No opportunities found</p>
                  <p className="text-sm text-muted-foreground">
                    {minScore > 0 ? 'Try lowering the minimum match filter.' : 'Upload your resume or fill in your profile to get recommendations.'}
                  </p>
                </div>
                <Link href="/candidate/profile" className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors">
                  Complete profile
                </Link>
              </div>
            ) : (
              <OpportunityGraph
                jobs={jobs}
                candidateName={session?.user?.name || 'You'}
                selectedJobId={selectedJob?.id}
                onJobClick={setSelectedJob}
                height={540}
              />
            )}
          </div>

          {/* Side panel */}
          <div className="lg:col-span-1 space-y-4">
            {selectedJob ? (
              <div className="glass rounded-2xl p-5 space-y-4">
                {/* Score badge */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-base leading-tight">{selectedJob.title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{selectedJob.companyName}</p>
                  </div>
                  <span className={`shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${scoreBg(selectedJob.score)}/15 ${scoreColor(selectedJob.score)} border border-current/20`}>
                    <Zap className="h-3 w-3" />
                    {selectedJob.score}%
                  </span>
                </div>

                {/* Score bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Match strength</span>
                    <span className={`font-bold ${scoreColor(selectedJob.score)}`}>{selectedJob.score}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${selectedJob.score}%`, background: selectedJob.score >= 75 ? '#16a34a' : selectedJob.score >= 50 ? '#d97706' : '#dc2626' }}
                    />
                  </div>
                </div>

                {/* Meta */}
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" />{selectedJob.location}</div>
                  {selectedJob.employmentType && (
                    <div className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 shrink-0" /><span className="capitalize">{selectedJob.employmentType}</span></div>
                  )}
                  {selectedJob.locationType && (
                    <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 shrink-0" /><span className="capitalize">{selectedJob.locationType}</span></div>
                  )}
                </div>

                {/* Required skills */}
                {selectedJob.requiredSkills && selectedJob.requiredSkills.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Required skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedJob.requiredSkills.slice(0, 8).map((s) => (
                        <span key={s.skill} className={`rounded-lg px-2 py-0.5 text-xs border ${
                          s.weight === 3 ? 'border-violet-500/40 bg-violet-500/15 text-violet-300' :
                          s.weight === 2 ? 'border-blue-500/30 bg-blue-500/10 text-blue-300' :
                          'border-white/10 bg-white/5 text-muted-foreground'
                        }`}>
                          {s.skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-1">
                  <Link
                    href={`/jobs/${selectedJob.id}`}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
                  >
                    View & Apply <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    onClick={() => {
                      setAutoApplyJobs([selectedJob])
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 py-2 text-sm text-violet-300 hover:bg-violet-500/20 transition-colors"
                  >
                    <Bot className="h-3.5 w-3.5" /> One-click apply
                  </button>
                </div>
              </div>
            ) : (
              <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
                <div className="text-3xl mb-2">🎯</div>
                <p className="font-medium mb-1">Click any node</p>
                <p className="text-xs">Select a job to see details and apply</p>
              </div>
            )}

            {/* Top 5 list */}
            {jobs.length > 0 && (
              <div className="glass rounded-2xl p-4">
                <h3 className="text-sm font-semibold mb-3">Top Matches</h3>
                <div className="space-y-2">
                  {jobs.slice(0, 5).map((job, i) => (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors ${
                        selectedJob?.id === job.id ? 'bg-violet-500/15 border border-violet-500/30' : 'hover:bg-white/5'
                      }`}
                    >
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                        i === 1 ? 'bg-gray-400/20 text-gray-300' :
                        i === 2 ? 'bg-amber-700/20 text-amber-600' :
                        'bg-white/10 text-muted-foreground'
                      }`}>
                        {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{job.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{job.companyName}</p>
                      </div>
                      <span className={`text-xs font-bold shrink-0 ${scoreColor(job.score)}`}>{job.score}%</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Auto-Apply Modal */}
      {autoApplyJobs && (
        <AutoApplyModal
          jobs={autoApplyJobs}
          onClose={() => setAutoApplyJobs(null)}
          onComplete={handleAutoApplyComplete}
        />
      )}
    </div>
  )
}
