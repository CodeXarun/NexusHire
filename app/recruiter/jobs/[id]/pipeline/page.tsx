'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { Pipeline, PipelineApplication } from '@/components/kanban/Pipeline'
import { Loader2, ArrowLeft, Network, X, ChevronRight, Save, CheckCircle, XCircle, MinusCircle, Users, MoveRight, GitCompare, Trophy, TrendingDown, FileText } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { scoreColor, scoreBg } from '@/lib/utils'
import { CompatibilityRadar, deriveRadarValues } from '@/components/RadarChart'

interface CompareCandidate {
  _id: string
  name: string
  email: string
  image: string | null
  headline: string
  skills: string[]
  matchScore: number
  stage: string
  outcome: string | null
  gap: number
  isTop: boolean
}

const MEDAL = ['🥇', '🥈', '🥉']

export default function PipelinePage() {
  const { id: jobId } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [selectedApp, setSelectedApp] = useState<PipelineApplication | null>(null)
  const [stageNote, setStageNote] = useState('')
  const [recruiterNotes, setRecruiterNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [loadingExplain, setLoadingExplain] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<string[]>([])
  const [bulkStage, setBulkStage] = useState('')
  const [bulkMoving, setBulkMoving] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareData, setCompareData] = useState<{ topCandidate: CompareCandidate | null; candidates: CompareCandidate[] } | null>(null)
  const [loadingCompare, setLoadingCompare] = useState(false)
  const [loadingResume, setLoadingResume] = useState(false)

  const { data: job } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => fetch(`/api/jobs/${jobId}`).then((r) => r.json()),
  })

  const { data: applicants, isLoading } = useQuery({
    queryKey: ['applicants', jobId],
    queryFn: () => fetch(`/api/jobs/${jobId}/applicants`).then((r) => r.json()),
  })

  const updateStage = useMutation({
    mutationFn: ({ appId, stage, note, outcome }: { appId: string; stage: string; note?: string; outcome?: string }) =>
      fetch(`/api/applications/${appId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, note, outcome }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicants', jobId] })
      toast.success('Stage updated')
    },
    onError: () => toast.error('Failed to update stage'),
  })

  const apps: PipelineApplication[] = Array.isArray(applicants) ? applicants : []

  // Rank by match score for medals
  const rankedIds = [...apps]
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3)
    .map((a) => a._id)

  async function handleStageChange(applicationId: string, newStage: string) {
    await updateStage.mutateAsync({ appId: applicationId, stage: newStage, note: stageNote })
  }

  async function handleOutcomeChange(applicationId: string, outcome: 'hired' | 'rejected') {
    await updateStage.mutateAsync({ appId: applicationId, stage: 'outcome', note: stageNote, outcome })
    if (selectedApp) {
      setSelectedApp({ ...selectedApp, stage: 'outcome', outcome })
    }
  }

  async function handleBulkMove() {
    if (!bulkStage || bulkSelected.length === 0) return
    setBulkMoving(true)
    try {
      await Promise.all(bulkSelected.map((id) =>
        fetch(`/api/applications/${id}/stage`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: bulkStage }),
        })
      ))
      queryClient.invalidateQueries({ queryKey: ['applicants', jobId] })
      toast.success(`Moved ${bulkSelected.length} candidates to ${bulkStage.replace('_', ' ')}`)
      setBulkSelected([])
      setBulkStage('')
    } catch {
      toast.error('Bulk move failed')
    } finally {
      setBulkMoving(false)
    }
  }

  async function handleSaveNotes() {
    if (!selectedApp) return
    setSavingNotes(true)
    try {
      await fetch(`/api/applications/${selectedApp._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recruiterNotes }),
      })
      toast.success('Notes saved')
    } catch {
      toast.error('Failed to save notes')
    } finally {
      setSavingNotes(false)
    }
  }

  async function loadExplanation() {
    if (!selectedApp || explanation) return
    setLoadingExplain(true)
    try {
      const res = await fetch(`/api/ai/explain-match?applicationId=${selectedApp._id}`)
      const data = await res.json()
      setExplanation(data.explanation)
    } catch {
      toast.error('Failed to load explanation')
    } finally {
      setLoadingExplain(false)
    }
  }

  async function handleOpenCompare() {
    setLoadingCompare(true)
    try {
      const res = await fetch(`/api/recruiter/compare?jobId=${jobId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCompareData(data)
      setCompareOpen(true)
    } catch {
      toast.error('Failed to load comparison')
    } finally {
      setLoadingCompare(false)
    }
  }

  async function handleViewResume() {
    if (!selectedApp) return
    setLoadingResume(true)
    try {
      const res = await fetch(`/api/recruiter/resume?applicationId=${selectedApp._id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch resume')
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load resume'
      toast.error(message)
    } finally {
      setLoadingResume(false)
    }
  }

  function openDrawer(app: PipelineApplication) {
    setSelectedApp(app)
    setRecruiterNotes((app as PipelineApplication & { recruiterNotes?: string }).recruiterNotes || '')
    setExplanation(null)
  }

  const radarValues = selectedApp
    ? deriveRadarValues({
        matchScore: { overall: selectedApp.matchScore, skillsMatch: (selectedApp as PipelineApplication & { matchScore: { skillsMatch?: number } }).matchScore?.skillsMatch ?? selectedApp.matchScore, experienceMatch: (selectedApp as PipelineApplication & { matchScore: { experienceMatch?: number } }).matchScore?.experienceMatch ?? selectedApp.matchScore },
        breakdown: (selectedApp as PipelineApplication & { breakdown?: Array<{ skill: string; match: string; type?: string }> }).breakdown,
        stage: selectedApp.stage,
      })
    : null

  const breakdown = selectedApp ? (selectedApp as PipelineApplication & { breakdown?: Array<{ skill: string; match: 'full' | 'partial' | 'none'; weight: number }> }).breakdown : undefined

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-full px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/recruiter/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <h1 className="text-2xl font-bold">Hiring Pipeline</h1>
            {job && <p className="text-muted-foreground mt-1">{job.title} · {apps.length} applicants</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenCompare}
              disabled={loadingCompare || apps.length === 0}
              className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
            >
              {loadingCompare ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompare className="h-4 w-4" />}
              Compare All
            </button>
            <Link
              href={`/recruiter/jobs/${jobId}/graph`}
              className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm text-violet-300 hover:bg-violet-500/20 transition-colors"
            >
              <Network className="h-4 w-4" />
              Graph view
            </Link>
          </div>
        </div>

        {/* Top 3 medal banner */}
        {apps.length > 0 && (
          <div className="mb-6 flex gap-3">
            {[...apps].sort((a, b) => b.matchScore - a.matchScore).slice(0, 3).map((app, i) => (
              <button
                key={app._id}
                onClick={() => openDrawer(app)}
                className="flex items-center gap-2 glass rounded-xl px-4 py-2 text-sm hover:bg-white/8 transition-colors"
              >
                <span className="text-base">{MEDAL[i]}</span>
                <div className="text-left">
                  <p className="font-medium text-xs">{app.candidate?.name}</p>
                  <p className={`text-xs font-bold ${scoreColor(app.matchScore)}`}>{app.matchScore}%</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Bulk action bar */}
        {bulkSelected.length > 0 && (
          <div className="mb-4 flex items-center gap-3 glass rounded-xl px-4 py-3">
            <Users className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-medium">{bulkSelected.length} selected</span>
            <div className="flex items-center gap-2 ml-auto">
              <select
                value={bulkStage}
                onChange={(e) => setBulkStage(e.target.value)}
                className="rounded-lg border border-white/10 bg-[hsl(0,0%,6%)] px-3 py-1.5 text-xs focus:outline-none"
              >
                <option value="">Move to stage…</option>
                {['applied', 'under_review', 'shortlisted', 'interview', 'decision', 'outcome'].map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
              <button
                onClick={handleBulkMove}
                disabled={!bulkStage || bulkMoving}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {bulkMoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoveRight className="h-3.5 w-3.5" />}
                Move
              </button>
              <button
                onClick={() => setBulkSelected([])}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>
        ) : (
          <Pipeline
            applications={apps}
            onStageChange={handleStageChange}
            onCardClick={openDrawer}
            topRankedIds={rankedIds}
            selectedIds={bulkSelected}
            onSelectionChange={setBulkSelected}
          />
        )}
      </div>

      {/* ── Compare Panel ────────────────────────────────────────────── */}
      {compareOpen && compareData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[hsl(0,0%,6%)] shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <GitCompare className="h-5 w-5 text-amber-400" />
                <h2 className="font-semibold">Candidate Comparison</h2>
                <span className="text-xs text-muted-foreground ml-1">
                  — ranked vs top performer
                </span>
              </div>
              <button
                onClick={() => setCompareOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-3">
              {compareData.candidates.length === 0 ? (
                <p className="text-center text-muted-foreground py-10 text-sm">No applicants yet.</p>
              ) : (
                compareData.candidates.map((c, idx) => (
                  <div
                    key={c._id}
                    className={`rounded-xl border p-4 flex items-center gap-4 transition-all ${
                      c.isTop
                        ? 'border-amber-500/40 bg-amber-500/8'
                        : 'border-white/10 bg-white/3'
                    }`}
                  >
                    {/* Rank */}
                    <div className="text-lg shrink-0 w-7 text-center">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (
                        <span className="text-xs text-muted-foreground font-medium">#{idx + 1}</span>
                      )}
                    </div>

                    {/* Avatar */}
                    {c.image ? (
                      <img src={c.image} alt="" className="h-9 w-9 rounded-full shrink-0" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-violet-600/30 flex items-center justify-center text-sm font-bold text-violet-400 shrink-0">
                        {c.name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{c.name}</p>
                        {c.isTop && (
                          <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded-full px-2 py-0.5 shrink-0">
                            <Trophy className="h-3 w-3" /> Top
                          </span>
                        )}
                        {c.outcome === 'hired' && (
                          <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5 shrink-0">Hired</span>
                        )}
                        {c.outcome === 'rejected' && (
                          <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5 shrink-0">Rejected</span>
                        )}
                      </div>
                      {c.headline && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.headline}</p>
                      )}
                      {/* Score bar */}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1.5 rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-600 to-purple-500"
                            style={{ width: `${c.matchScore}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold shrink-0 ${scoreColor(c.matchScore)}`}>
                          {c.matchScore}%
                        </span>
                      </div>
                    </div>

                    {/* Gap badge */}
                    <div className="shrink-0 text-right">
                      {c.isTop ? (
                        <span className="text-xs text-amber-400 font-medium">Benchmark</span>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                          <span className="text-red-400 font-medium">-{c.gap}%</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                        {c.stage.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer note */}
            <div className="px-6 py-4 border-t border-white/10 shrink-0">
              <p className="text-xs text-muted-foreground">
                Gap is the difference in match score vs. the top-ranked candidate.
                Use this to prioritise shortlisting.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Side drawer */}
      {selectedApp && (
        <div className="fixed inset-y-0 right-0 w-96 bg-[hsl(0,0%,6%)] border-l border-white/10 p-6 overflow-y-auto z-50 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold">Applicant Details</h2>
            <button onClick={() => setSelectedApp(null)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Candidate info */}
          <div className="flex items-center gap-3 mb-6">
            {selectedApp.candidate?.image ? (
              <img src={selectedApp.candidate.image} alt="" className="h-12 w-12 rounded-full" />
            ) : (
              <div className="h-12 w-12 rounded-full bg-violet-600/30 flex items-center justify-center text-lg font-bold text-violet-400">
                {selectedApp.candidate?.name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{selectedApp.candidate?.name}</p>
                {rankedIds.indexOf(selectedApp._id) >= 0 && (
                  <span className="text-base">{MEDAL[rankedIds.indexOf(selectedApp._id)]}</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{selectedApp.candidate?.email}</p>
              {selectedApp.candidate?.headline && (
                <p className="text-xs text-muted-foreground mt-0.5">{selectedApp.candidate.headline}</p>
              )}
            </div>
          </div>

          {/* Resume button */}
          {selectedApp.candidate?.resumeS3Key ? (
            <button
              onClick={handleViewResume}
              disabled={loadingResume}
              className="w-full mb-4 flex items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-sm text-violet-300 hover:bg-violet-500/20 transition-colors disabled:opacity-50"
            >
              {loadingResume
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <FileText className="h-4 w-4" />}
              {loadingResume ? 'Opening resume…' : 'View Resume PDF'}
            </button>
          ) : (
            <div className="w-full mb-4 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/3 px-4 py-2.5 text-sm text-muted-foreground cursor-not-allowed">
              <FileText className="h-4 w-4" />
              No resume uploaded
            </div>
          )}

          {/* Radar chart */}
          {radarValues && (
            <div className="mb-4 glass rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-2">Compatibility Radar</p>
              <div className="max-w-[200px] mx-auto">
                <CompatibilityRadar {...radarValues} />
              </div>
            </div>
          )}

          {/* Match score */}
          <div className="glass rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Match Score</span>
              <span className={`text-lg font-bold ${scoreColor(selectedApp.matchScore)}`}>
                {selectedApp.matchScore}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-purple-500"
                style={{ width: `${selectedApp.matchScore}%` }}
              />
            </div>
            {selectedApp.percentileRank !== undefined && (
              <p className="mt-1.5 text-xs text-muted-foreground">Top {100 - selectedApp.percentileRank}% of applicants</p>
            )}
          </div>

          {/* Per-skill checklist */}
          {breakdown && breakdown.length > 0 && (
            <div className="glass rounded-xl p-4 mb-4">
              <p className="text-xs text-muted-foreground mb-3">Skill Breakdown</p>
              <div className="space-y-2">
                {breakdown.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {item.match === 'full' ? (
                      <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />
                    ) : item.match === 'partial' ? (
                      <MinusCircle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    )}
                    <span className={item.match === 'none' ? 'text-muted-foreground' : ''}>{item.skill}</span>
                    {item.weight === 3 && <span className="ml-auto text-muted-foreground text-xs">req</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI explanation */}
          <div className="mb-4">
            {explanation ? (
              <div className="glass rounded-xl p-3 text-xs text-muted-foreground leading-relaxed">
                <p className="text-violet-300 font-medium mb-1">Match Explanation</p>
                {explanation}
              </div>
            ) : (
              <button
                onClick={loadExplanation}
                disabled={loadingExplain}
                className="w-full flex items-center justify-center gap-1.5 glass rounded-xl px-3 py-2 text-xs text-violet-300 hover:bg-white/8 transition-colors disabled:opacity-50"
              >
                {loadingExplain ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Load AI explanation
              </button>
            )}
          </div>

          {/* Stage selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Move to stage</label>
            <div className="space-y-2">
              {['applied', 'under_review', 'shortlisted', 'interview', 'decision', 'outcome'].map((s) => (
                <button
                  key={s}
                  onClick={async () => {
                    await handleStageChange(selectedApp._id, s)
                    setSelectedApp({ ...selectedApp, stage: s })
                  }}
                  className={`w-full flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition-colors ${
                    selectedApp.stage === s
                      ? 'border-violet-500 bg-violet-500/15 text-violet-300'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <span className="capitalize">{s.replace('_', ' ')}</span>
                  {selectedApp.stage === s && <ChevronRight className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>

          {/* Final Outcome */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Final Outcome</label>
            <div className="flex gap-2">
              <button
                onClick={() => handleOutcomeChange(selectedApp._id, 'hired')}
                disabled={selectedApp.outcome === 'hired'}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  selectedApp.outcome === 'hired'
                    ? 'border-green-500 bg-green-500/15 text-green-400'
                    : 'border-green-500/30 bg-green-500/10 text-green-500 hover:bg-green-500/20'
                }`}
              >
                <CheckCircle className="h-4 w-4" />
                {selectedApp.outcome === 'hired' ? 'Hired' : 'Hire'}
              </button>
              <button
                onClick={() => handleOutcomeChange(selectedApp._id, 'rejected')}
                disabled={selectedApp.outcome === 'rejected'}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  selectedApp.outcome === 'rejected'
                    ? 'border-red-500 bg-red-500/15 text-red-400'
                    : 'border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20'
                }`}
              >
                <XCircle className="h-4 w-4" />
                {selectedApp.outcome === 'rejected' ? 'Rejected' : 'Reject'}
              </button>
            </div>
            {selectedApp.outcome && (
              <p className="mt-2 text-xs text-muted-foreground">
                Application closed as <strong>{selectedApp.outcome}</strong>.
              </p>
            )}
          </div>

          {/* Note for stage change */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1.5">Note (for stage change)</label>
            <textarea
              rows={2}
              value={stageNote}
              onChange={(e) => setStageNote(e.target.value)}
              placeholder="Optional note…"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all resize-none"
            />
          </div>

          {/* Recruiter private notes */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1.5">Private notes</label>
            <textarea
              rows={3}
              value={recruiterNotes}
              onChange={(e) => setRecruiterNotes(e.target.value)}
              placeholder="Private notes visible only to you…"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all resize-none"
            />
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {savingNotes ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save notes
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
