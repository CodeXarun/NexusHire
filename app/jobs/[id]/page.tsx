'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { toast } from 'sonner'
import { MapPin, Clock, DollarSign, Users, Briefcase, ArrowLeft, Loader2, Zap, CheckCircle, XCircle, MinusCircle } from 'lucide-react'
import { formatSalary, scoreColor, scoreBg } from '@/lib/utils'
import Link from 'next/link'

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const router = useRouter()
  const [coverLetter, setCoverLetter] = useState('')
  const [showApply, setShowApply] = useState(false)
  const [appliedResult, setAppliedResult] = useState<{
    matchScore: { overall: number; skillsMatch: number; experienceMatch: number; explanation: string }
    breakdown: Array<{ skill: string; match: 'full' | 'partial' | 'none'; weight: number }>
    percentileRank: number
    _id: string
  } | null>(null)

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => fetch(`/api/jobs/${id}`).then((r) => r.json()),
  })

  // Track job view for adaptive ranking (fire-and-forget, only for candidates)
  useEffect(() => {
    if (id && session?.user?.role === 'candidate') {
      fetch('/api/candidate/track-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: id }),
      }).catch(() => {})
    }
  }, [id, session?.user?.role])

  const apply = useMutation({
    mutationFn: () =>
      fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: id, coverLetter }),
      }).then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(d.error))
        return r.json()
      }),
    onSuccess: (data) => {
      toast.success('Application submitted!')
      setShowApply(false)
      setAppliedResult(data)
    },
    onError: (e: string) => toast.error(e || 'Failed to apply'),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center py-40">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      </div>
    )
  }

  if (!job || job.error) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <p className="text-muted-foreground">Job not found.</p>
          <Link href="/jobs" className="text-violet-400 text-sm hover:text-violet-300">← Back to jobs</Link>
        </div>
      </div>
    )
  }

  const isCandidate = session?.user?.role === 'candidate'

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to jobs
        </Link>

        <div className="glass rounded-2xl p-8 gradient-border">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{job.title}</h1>
              <p className="mt-1 text-muted-foreground">{job.companyName}</p>
            </div>
            <div className="flex flex-col items-end gap-3">
              {/* Pre-apply match score */}
              {isCandidate && job._preMatchScore !== undefined && !appliedResult && (
                <div className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${scoreBg(job._preMatchScore)} ${scoreColor(job._preMatchScore)}`}>
                  <Zap className="h-4 w-4" />
                  {job._preMatchScore}% match
                </div>
              )}
              {isCandidate && !job._alreadyApplied && !appliedResult && !showApply && (
                <button
                  onClick={() => setShowApply(true)}
                  className="shrink-0 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
                >
                  Apply now
                </button>
              )}
              {(job._alreadyApplied || appliedResult) && (
                <span className="flex items-center gap-1.5 rounded-xl bg-green-500/15 border border-green-500/30 px-4 py-2 text-sm text-green-400">
                  <CheckCircle className="h-4 w-4" /> Applied
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{job.location}</span>
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /><span className="capitalize">{job.locationType}</span></span>
            <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4" />{job.employmentType}</span>
            {job.salaryRange && (
              <span className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" />
                {formatSalary(job.salaryRange.min, job.salaryRange.currency)} – {formatSalary(job.salaryRange.max, job.salaryRange.currency)}
              </span>
            )}
            <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{job.applicantCount || 0} applicants</span>
          </div>

          {/* Description */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-3">About this role</h2>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{job.description}</p>
          </div>

          {/* Required skills */}
          {job.requiredSkills?.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-3">Required skills</h2>
              <div className="flex flex-wrap gap-2">
                {job.requiredSkills.map((s: { skill: string; weight: number; type: string }) => (
                  <span
                    key={s.skill}
                    className={`rounded-lg border px-3 py-1 text-sm ${
                      s.weight === 3
                        ? 'border-violet-500/40 bg-violet-500/15 text-violet-300'
                        : s.weight === 2
                        ? 'border-blue-500/40 bg-blue-500/15 text-blue-300'
                        : 'border-white/10 bg-white/5 text-muted-foreground'
                    }`}
                  >
                    {s.skill}
                    {s.weight === 3 && <span className="ml-1 text-xs opacity-60">★★★</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Post-apply breakdown */}
          {appliedResult && (
            <div className="mt-8 border-t border-white/10 pt-8">
              <h2 className="text-lg font-semibold mb-4">Your Match Breakdown</h2>
              <div className="grid sm:grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'Overall', value: appliedResult.matchScore?.overall ?? 0 },
                  { label: 'Skills', value: appliedResult.matchScore?.skillsMatch ?? 0 },
                  { label: 'Experience', value: appliedResult.matchScore?.experienceMatch ?? 0 },
                ].map(({ label, value }) => (
                  <div key={label} className="glass rounded-xl p-4 text-center">
                    <div className={`text-2xl font-bold ${scoreColor(value)}`}>{value}%</div>
                    <div className="text-xs text-muted-foreground mt-1">{label}</div>
                  </div>
                ))}
              </div>

              {appliedResult.matchScore?.explanation && (
                <div className="mb-4 rounded-xl border border-violet-500/20 bg-violet-500/8 p-4 text-sm text-muted-foreground">
                  {appliedResult.matchScore.explanation}
                </div>
              )}

              {appliedResult.percentileRank !== undefined && (
                <p className="text-sm text-violet-300 mb-4">
                  You are in the top <strong>{100 - appliedResult.percentileRank}%</strong> of applicants for this role.
                </p>
              )}

              {appliedResult.breakdown?.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-3">Per-skill breakdown</h3>
                  <div className="space-y-2">
                    {appliedResult.breakdown.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        {item.match === 'full' ? (
                          <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                        ) : item.match === 'partial' ? (
                          <MinusCircle className="h-4 w-4 text-yellow-400 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                        )}
                        <span className={item.match === 'none' ? 'text-muted-foreground' : 'text-foreground'}>{item.skill}</span>
                        {item.weight === 3 && <span className="text-xs text-muted-foreground">(required)</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex gap-3">
                <Link
                  href="/candidate/applications"
                  className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
                >
                  Track application
                </Link>
                <Link
                  href={`/candidate/skill-gap?applicationId=${appliedResult._id}`}
                  className="rounded-xl border border-white/10 px-5 py-2.5 text-sm hover:bg-white/5 transition-colors"
                >
                  View skill gap
                </Link>
              </div>
            </div>
          )}

          {/* Apply form */}
          {showApply && isCandidate && (
            <div className="mt-8 border-t border-white/10 pt-8">
              <h2 className="text-lg font-semibold mb-4">Apply for this position</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Cover letter (optional)</label>
                  <textarea
                    rows={5}
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    placeholder="Tell us why you're a great fit…"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all resize-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => apply.mutate()}
                    disabled={apply.isPending}
                    className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
                  >
                    {apply.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {apply.isPending ? 'Scoring your match…' : 'Submit application'}
                  </button>
                  <button
                    onClick={() => setShowApply(false)}
                    className="rounded-xl border border-white/10 px-6 py-2.5 text-sm hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {!session && (
            <div className="mt-8 border-t border-white/10 pt-6 text-center">
              <p className="text-muted-foreground text-sm">
                <Link href="/login" className="text-violet-400 hover:text-violet-300">Sign in</Link>{' '}
                to apply for this job.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
