'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Navbar } from '@/components/Navbar'
import {
  Loader2, ArrowLeft, Target, BookOpen, Clock, CheckCircle, RefreshCw,
  Youtube, FileText, GraduationCap, Code, ExternalLink, AlertTriangle,
  MessageSquare, Users, Lightbulb, TrendingUp, Sparkles,
} from 'lucide-react'
import Link from 'next/link'

interface Resource { title: string; url: string; type: string }

const TYPE_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  video:    { icon: <Youtube className="h-3.5 w-3.5" />,       label: 'Video',    color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  article:  { icon: <FileText className="h-3.5 w-3.5" />,      label: 'Article',  color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  course:   { icon: <GraduationCap className="h-3.5 w-3.5" />, label: 'Course',   color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  docs:     { icon: <BookOpen className="h-3.5 w-3.5" />,      label: 'Docs',     color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  practice: { icon: <Code className="h-3.5 w-3.5" />,          label: 'Practice', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
}

const GAP_TYPE_LABEL: Record<string, string> = {
  missing: 'Missing skill',
  weak: 'Needs strengthening',
  experience_level: 'Experience gap',
}

function ResourceCard({ resource }: { resource: Resource }) {
  const meta = TYPE_META[resource.type] ?? TYPE_META.article
  const hasUrl = resource.url && resource.url.startsWith('http')
  return (
    <a
      href={hasUrl ? resource.url : undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${meta.color} ${hasUrl ? 'hover:opacity-80 cursor-pointer' : 'cursor-default opacity-70'}`}
    >
      {meta.icon}
      <span className="flex-1 font-medium">{resource.title}</span>
      {hasUrl && <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />}
    </a>
  )
}

interface RejectionAnalysis {
  summary: string
  recruiterFeedbackInsight: string
  topGaps: Array<{ skill: string; gapType: string; reason: string; priority: string }>
  comparedToSelected: string | null
  actionableSteps: string[]
  encouragement: string
}

function RejectionAnalysisPanel({
  applicationId,
  embedded = false,
}: {
  applicationId: string
  embedded?: boolean
}) {
  const [generating, setGenerating] = useState(false)
  const [analysis, setAnalysis] = useState<RejectionAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/skill-gap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setAnalysis(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate')
    } finally {
      setGenerating(false)
    }
  }

  if (!analysis && !generating && !error) {
    return (
      <div className={`glass rounded-2xl p-6 ${embedded ? '' : 'gradient-border'}`}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5 text-violet-400" />
          <h2 className="font-semibold">AI Rejection Analysis</h2>
          <span className="ml-auto text-xs bg-violet-500/15 text-violet-400 border border-violet-500/30 px-2 py-0.5 rounded-full">New</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Get a personalised analysis that compares you against selected candidates,
          interprets the recruiter&apos;s feedback, and gives you concrete next steps.
        </p>
        <button
          onClick={generate}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          Generate Deep Analysis
        </button>
      </div>
    )
  }

  if (generating) {
    return (
      <div className="glass rounded-2xl p-8 flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        <p className="text-sm text-muted-foreground">Analysing recruiter feedback &amp; comparing to selected candidates…</p>
        <p className="text-xs text-muted-foreground opacity-60">This may take 20–40 seconds</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass rounded-2xl p-6 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 text-red-400 mx-auto" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <button onClick={generate} className="flex items-center gap-2 mx-auto rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    )
  }

  if (!analysis) return null

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="glass rounded-2xl p-6 gradient-border">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-5 w-5 text-violet-400" />
          <h2 className="font-semibold">Why You Were Rejected</h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{analysis.summary}</p>

        {/* Encouragement */}
        <div className="mt-4 rounded-xl bg-violet-500/10 border border-violet-500/20 px-4 py-3">
          <p className="text-xs text-violet-300 italic">&quot;{analysis.encouragement}&quot;</p>
        </div>
      </div>

      {/* Recruiter Feedback Insight */}
      {analysis.recruiterFeedbackInsight && (
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-amber-400" />
            <h3 className="font-semibold text-sm">Reading Between the Lines</h3>
            <span className="text-xs text-muted-foreground">(recruiter&apos;s feedback decoded)</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{analysis.recruiterFeedbackInsight}</p>
        </div>
      )}

      {/* Top Gaps */}
      {analysis.topGaps?.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-red-400" />
            <h3 className="font-semibold">Key Gaps Identified</h3>
          </div>
          <div className="space-y-3">
            {analysis.topGaps.map((gap, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/3 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{gap.skill}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {GAP_TYPE_LABEL[gap.gapType] || gap.gapType}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      gap.priority === 'high' ? 'bg-red-500/15 text-red-400' :
                      gap.priority === 'medium' ? 'bg-yellow-500/15 text-yellow-400' :
                      'bg-green-500/15 text-green-400'
                    }`}>
                      {gap.priority}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{gap.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compared to Selected */}
      {analysis.comparedToSelected && (
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-blue-400" />
            <h3 className="font-semibold text-sm">vs. Selected Candidates</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{analysis.comparedToSelected}</p>
        </div>
      )}

      {/* Actionable Steps */}
      {analysis.actionableSteps?.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-5 w-5 text-yellow-400" />
            <h3 className="font-semibold">Your Action Plan</h3>
          </div>
          <div className="space-y-2">
            {analysis.actionableSteps.map((step, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="h-6 w-6 rounded-full bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center text-xs font-bold text-yellow-400 shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={generate}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <RefreshCw className="h-3 w-3" /> Regenerate analysis
      </button>
    </div>
  )
}

function SkillGapContent() {
  const searchParams = useSearchParams()
  const applicationId = searchParams.get('applicationId')
  const jobId = searchParams.get('jobId')
  const showRejection = searchParams.get('rejected') === 'true'
  const [regenerate, setRegenerate] = useState(false)

  const buildParams = (regen = regenerate) => {
    const p = new URLSearchParams()
    if (applicationId) p.set('applicationId', applicationId)
    if (jobId) p.set('jobId', jobId)
    if (regen) p.set('regenerate', 'true')
    return p.toString()
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['skill-gap', applicationId, jobId, regenerate],
    queryFn: () => fetch(`/api/ai/skill-gap?${buildParams()}`).then((r) => r.json()),
    enabled: !!(applicationId || jobId),
  })

  function handleRegenerate() {
    setRegenerate(true)
    setTimeout(() => refetch(), 50)
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href="/candidate/applications"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Skill Gap Analysis</h1>
            <p className="text-muted-foreground mt-1">AI-generated learning path to close your skill gap.</p>
          </div>
          {data && !isLoading && (
            <button
              onClick={handleRegenerate}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground hover:bg-white/10 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </button>
          )}
        </div>

        {/* ── Contextual Rejection Analysis (if rejected) ── */}
        {applicationId && showRejection && (
          <div className="mb-8">
            <RejectionAnalysisPanel applicationId={applicationId} />
          </div>
        )}

        {/* ── Standard JD-based skill gap ─────────────────── */}
        {(applicationId || jobId) && (
          <>
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="h-4 w-4 text-violet-400" />
              <h2 className="font-semibold">JD Skill Gap &amp; Learning Path</h2>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                <p className="text-muted-foreground text-sm">Analyzing your profile against job requirements…</p>
                <p className="text-xs text-muted-foreground opacity-60">This may take 15–30 seconds</p>
              </div>
            ) : isError || data?.error ? (
              <div className="glass rounded-2xl p-8 text-center space-y-4">
                <p className="text-muted-foreground">Failed to generate analysis.</p>
                <button
                  onClick={handleRegenerate}
                  className="flex items-center gap-2 mx-auto rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" /> Try again
                </button>
              </div>
            ) : data?.allSkillsMatched ? (
              <div className="glass rounded-2xl p-10 text-center gradient-border">
                <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">You&apos;re fully qualified!</h2>
                <p className="text-muted-foreground text-sm">
                  Your profile matches all {data.requiredCount || 'required'} skills for this role.
                  No skill gap to close.
                </p>
                <Link
                  href="/candidate/applications"
                  className="inline-flex mt-6 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
                >
                  Back to applications
                </Link>
              </div>
            ) : data?.missingSkills?.length > 0 ? (
              <div className="space-y-6">
                {/* Missing skills */}
                <div className="glass rounded-2xl p-6 gradient-border">
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="h-5 w-5 text-violet-400" />
                    <h2 className="font-semibold">Skills to Acquire ({data.missingSkills.length})</h2>
                  </div>
                  <div className="space-y-3">
                    {data.missingSkills.map((skill: { skill: string; priority: string; resources: Resource[]; weeklyPlan?: string[] }, i: number) => (
                      <div key={i} className="rounded-xl border border-white/10 bg-white/3 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium text-sm">{skill.skill}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            skill.priority === 'high' ? 'bg-red-500/15 text-red-400' :
                            skill.priority === 'medium' ? 'bg-yellow-500/15 text-yellow-400' :
                            'bg-green-500/15 text-green-400'
                          }`}>
                            {skill.priority} priority
                          </span>
                        </div>
                        {skill.resources?.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground mb-1.5">Learning resources:</p>
                            {skill.resources.map((r, ri) => (
                              <ResourceCard key={ri} resource={typeof r === 'string' ? { title: r, url: '', type: 'article' } : r} />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline */}
                {data.timeline && (
                  <div className="glass rounded-2xl p-6 gradient-border">
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="h-5 w-5 text-violet-400" />
                      <h2 className="font-semibold">Learning Timeline</h2>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Estimated time to close your skill gap: <strong className="text-foreground">{data.timeline}</strong>
                    </p>

                    {data.steps?.length > 0 && (
                      <div className="space-y-3">
                        {data.steps.map((step: { week: number; focus: string; tasks: string[] }, i: number) => (
                          <div key={i} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className="h-7 w-7 rounded-full bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-xs font-bold text-violet-400 shrink-0">
                                {step.week}
                              </div>
                              {i < data.steps.length - 1 && (
                                <div className="flex-1 w-px bg-white/10 my-1" />
                              )}
                            </div>
                            <div className="pb-3">
                              <p className="font-medium text-sm">Week {step.week}: {step.focus}</p>
                              <ul className="mt-1 space-y-0.5">
                                {step.tasks?.map((task: string, ti: number) => (
                                  <li key={ti} className="text-xs text-muted-foreground flex gap-1.5">
                                    <span className="text-violet-500 shrink-0">•</span>
                                    {task}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Fallback: data loaded but empty — force regenerate */
              <div className="glass rounded-2xl p-10 text-center space-y-4">
                <p className="text-muted-foreground">No analysis available yet.</p>
                <button
                  onClick={handleRegenerate}
                  disabled={isLoading}
                  className="flex items-center gap-2 mx-auto rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Generate analysis
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function SkillGapPage() {
  return (
    <Suspense>
      <SkillGapContent />
    </Suspense>
  )
}
