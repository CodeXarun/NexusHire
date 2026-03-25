'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { ApplicationGraph, GraphNode, GraphLink, OverlapLink } from '@/components/graph/ApplicationGraph'
import { Loader2, ArrowLeft, Info, LayoutList, Network, CheckCircle, XCircle, MinusCircle } from 'lucide-react'
import Link from 'next/link'
import { scoreColor, scoreBg } from '@/lib/utils'
import { CompatibilityRadar, deriveRadarValues } from '@/components/RadarChart'

const MEDAL = ['🥇', '🥈', '🥉']

interface Applicant {
  _id: string
  stage: string
  outcome?: string
  matchScore: number
  percentileRank?: number
  candidate?: { name: string; headline?: string; email?: string }
  jobId: string
  breakdown?: Array<{ skill: string; match: 'full' | 'partial' | 'none'; weight: number; type?: string }>
  matchScore_detail?: { skillsMatch: number; experienceMatch: number }
}

export default function ApplicationGraphPage() {
  const { id: jobId } = useParams<{ id: string }>()
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph')

  // Filters
  const [minScore, setMinScore] = useState(0)
  const [stageFilter, setStageFilter] = useState('all')

  const { data: job } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => fetch(`/api/jobs/${jobId}`).then((r) => r.json()),
  })

  const { data: applicants, isLoading } = useQuery({
    queryKey: ['applicants', jobId],
    queryFn: () => fetch(`/api/jobs/${jobId}/applicants`).then((r) => r.json()),
  })

  const allApps: Applicant[] = Array.isArray(applicants) ? applicants : []

  // Apply filters
  const apps = useMemo(() => allApps.filter((a) => {
    if (a.matchScore < minScore) return false
    if (stageFilter !== 'all' && a.stage !== stageFilter) return false
    return true
  }), [allApps, minScore, stageFilter])

  const rankedIds = [...allApps].sort((a, b) => b.matchScore - a.matchScore).slice(0, 3).map((a) => a._id)

  // Build graph data
  const jobNode: GraphNode = { id: `job-${jobId}`, type: 'job', label: job?.title || 'Job' }
  const candidateNodes: GraphNode[] = apps.map((app) => ({
    id: `candidate-${app._id}`,
    type: 'candidate',
    label: app.candidate?.name || 'Candidate',
    score: app.matchScore,
    stage: app.stage,
  }))
  const links: GraphLink[] = apps.map((app) => ({
    source: `job-${jobId}`,
    target: `candidate-${app._id}`,
    score: app.matchScore,
    stage: app.stage,
  }))
  const nodes: GraphNode[] = [jobNode, ...candidateNodes]

  // Skill-overlap edges: connect candidates sharing 3+ matched skills
  const overlapLinks = useMemo<OverlapLink[]>(() => {
    const result: OverlapLink[] = []
    for (let i = 0; i < apps.length; i++) {
      const skillsA = new Set(
        (apps[i].breakdown ?? []).filter((b) => b.match !== 'none').map((b) => b.skill.toLowerCase())
      )
      for (let j = i + 1; j < apps.length; j++) {
        const shared = (apps[j].breakdown ?? [])
          .filter((b) => b.match !== 'none' && skillsA.has(b.skill.toLowerCase()))
          .map((b) => b.skill)
        if (shared.length >= 3) {
          result.push({
            source: `candidate-${apps[i]._id}`,
            target: `candidate-${apps[j]._id}`,
            sharedSkills: shared,
          })
        }
      }
    }
    return result
  }, [apps])

  // Find full applicant for selected node
  const selectedApp = selectedNode?.type === 'candidate'
    ? allApps.find((a) => `candidate-${a._id}` === selectedNode.id)
    : null

  const radarValues = selectedApp
    ? deriveRadarValues({
        matchScore: { overall: selectedApp.matchScore, skillsMatch: selectedApp.matchScore, experienceMatch: selectedApp.matchScore },
        breakdown: selectedApp.breakdown,
        stage: selectedApp.stage,
      })
    : null

  const STAGES_LIST = ['applied', 'under_review', 'shortlisted', 'interview', 'decision', 'outcome']

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href={`/recruiter/jobs/${jobId}/pipeline`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to pipeline
            </Link>
            <h1 className="text-2xl font-bold">Application Graph</h1>
            {job && <p className="text-muted-foreground mt-1">{job.title} · {allApps.length} applicants</p>}
          </div>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
              <button
                onClick={() => setViewMode('graph')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${viewMode === 'graph' ? 'bg-violet-600 text-white' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Network className="h-3.5 w-3.5" /> Graph
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${viewMode === 'list' ? 'bg-violet-600 text-white' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <LayoutList className="h-3.5 w-3.5" /> List
              </button>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground glass rounded-xl px-4 py-2">
              <Info className="h-3.5 w-3.5 text-violet-400" />
              Click to inspect
            </div>
          </div>
        </div>

        {/* Filter controls */}
        <div className="mb-4 flex flex-wrap items-center gap-4 glass rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <label className="text-muted-foreground text-xs">Min score:</label>
            <input
              type="range"
              min={0}
              max={100}
              step={10}
              value={minScore}
              onChange={(e) => setMinScore(+e.target.value)}
              className="w-28 accent-violet-600"
            />
            <span className="text-xs font-medium w-8">{minScore}%</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-muted-foreground text-xs">Stage:</label>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-[hsl(0,0%,6%)] px-2 py-1 text-xs focus:outline-none"
            >
              <option value="all">All stages</option>
              {STAGES_LIST.map((s) => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <span className="text-xs text-muted-foreground ml-auto">{apps.length} showing</span>
        </div>

        {/* Legend */}
        <div className="mb-4 flex flex-wrap gap-3 text-xs">
          {[
            { color: '#60a5fa', label: 'Applied' },
            { color: '#facc15', label: 'Under Review' },
            { color: '#34d399', label: 'Shortlisted' },
            { color: '#a78bfa', label: 'Interview' },
            { color: '#fb923c', label: 'Decision' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
          {overlapLinks.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="h-0 w-5 border-t border-dashed border-yellow-400/50" />
              <span className="text-muted-foreground">Shared skills (3+)</span>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Main view */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="flex items-center justify-center h-96 glass rounded-xl">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              </div>
            ) : apps.length === 0 ? (
              <div className="flex items-center justify-center h-96 glass rounded-xl text-muted-foreground text-sm">
                No applicants match your filters.
              </div>
            ) : viewMode === 'graph' ? (
              <ApplicationGraph
                nodes={nodes}
                links={links}
                overlapLinks={overlapLinks}
                height={500}
                onNodeClick={setSelectedNode}
              />
            ) : (
              /* Ranked list view */
              <div className="glass rounded-2xl overflow-hidden">
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-white/10 text-xs text-muted-foreground font-medium">
                  <span>#</span>
                  <span>Candidate</span>
                  <span>Score</span>
                  <span>Stage</span>
                  <span>Percentile</span>
                </div>
                <div className="divide-y divide-white/5">
                  {[...apps].sort((a, b) => b.matchScore - a.matchScore).map((app, i) => (
                    <div key={app._id} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-5 py-3 items-center hover:bg-white/5 transition-colors">
                      <span className="text-sm w-6">{rankedIds.indexOf(app._id) >= 0 ? MEDAL[rankedIds.indexOf(app._id)] : `${i + 1}`}</span>
                      <div>
                        <p className="text-sm font-medium">{app.candidate?.name}</p>
                        {app.candidate?.headline && <p className="text-xs text-muted-foreground">{app.candidate.headline}</p>}
                      </div>
                      <span className={`text-sm font-bold ${scoreColor(app.matchScore)}`}>{app.matchScore}%</span>
                      <span className="text-xs text-muted-foreground capitalize">{app.stage.replace('_', ' ')}</span>
                      <span className="text-xs text-muted-foreground">
                        {app.percentileRank !== undefined ? `Top ${100 - app.percentileRank}%` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Side panel */}
          <div className="lg:col-span-1 space-y-4">
            {selectedNode ? (
              <div className="glass rounded-2xl p-5">
                <div className="mb-4">
                  <div className="h-12 w-12 rounded-xl bg-violet-600/20 flex items-center justify-center text-2xl mb-3">
                    {selectedNode.type === 'job' ? '💼' : '👤'}
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{selectedNode.label}</h3>
                    {selectedApp && rankedIds.indexOf(selectedApp._id) >= 0 && (
                      <span className="text-base">{MEDAL[rankedIds.indexOf(selectedApp._id)]}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">{selectedNode.type}</p>
                </div>

                {selectedNode.type === 'candidate' && selectedApp && (
                  <>
                    {/* Match score */}
                    <div className="mb-3">
                      <div className="text-xs text-muted-foreground mb-1">Match score</div>
                      <span className={`text-lg font-bold ${scoreColor(selectedApp.matchScore)}`}>
                        {selectedApp.matchScore}%
                      </span>
                      <div className="mt-1 h-1.5 rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-600 to-purple-500"
                          style={{ width: `${selectedApp.matchScore}%` }}
                        />
                      </div>
                      {selectedApp.percentileRank !== undefined && (
                        <p className="mt-1 text-xs text-muted-foreground">Top {100 - selectedApp.percentileRank}%</p>
                      )}
                    </div>

                    {/* Radar chart */}
                    {radarValues && (
                      <div className="mb-3">
                        <div className="text-xs text-muted-foreground mb-2">Compatibility Radar</div>
                        <CompatibilityRadar {...radarValues} />
                      </div>
                    )}

                    {/* Per-skill checklist */}
                    {selectedApp.breakdown && selectedApp.breakdown.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-muted-foreground mb-2">Skill Breakdown</div>
                        <div className="space-y-1.5">
                          {selectedApp.breakdown.map((item, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              {item.match === 'full' ? (
                                <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />
                              ) : item.match === 'partial' ? (
                                <MinusCircle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                              )}
                              <span className={item.match === 'none' ? 'text-muted-foreground' : ''}>{item.skill}</span>
                              {item.weight === 3 && <span className="ml-auto text-muted-foreground">req</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedApp.stage && (
                      <div className="mb-3">
                        <div className="text-xs text-muted-foreground mb-1">Stage</div>
                        <span className="capitalize text-sm font-medium">{selectedApp.stage.replace('_', ' ')}</span>
                      </div>
                    )}

                    {selectedApp.outcome && (
                      <div className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                        selectedApp.outcome === 'hired'
                          ? 'border-green-500 bg-green-500/15 text-green-400'
                          : 'border-red-500 bg-red-500/15 text-red-400'
                      }`}>
                        Application closed: <span className="capitalize">{selectedApp.outcome}</span>
                      </div>
                    )}
                  </>
                )}

                {selectedNode.type === 'job' && (
                  <div className="text-sm text-muted-foreground">
                    {apps.length} total applicants
                  </div>
                )}
              </div>
            ) : (
              <div className="glass rounded-2xl p-5 text-center text-sm text-muted-foreground">
                <div className="text-2xl mb-2">👆</div>
                Click a node to inspect
              </div>
            )}

            {/* Top candidates */}
            {allApps.length > 0 && (
              <div className="glass rounded-2xl p-4">
                <h3 className="text-sm font-semibold mb-3">Top Matches</h3>
                <div className="space-y-2">
                  {[...allApps].sort((a, b) => b.matchScore - a.matchScore).slice(0, 5).map((app, i) => (
                    <div key={app._id} className="flex items-center gap-2 text-sm">
                      <div className="h-7 w-7 rounded-full bg-violet-600/20 flex items-center justify-center text-xs font-bold text-violet-400 shrink-0">
                        {i < 3 ? MEDAL[i] : app.candidate?.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-medium">{app.candidate?.name}</p>
                      </div>
                      <span className={`text-xs font-bold ${scoreColor(app.matchScore)}`}>{app.matchScore}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
