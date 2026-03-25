'use client'

import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { Loader2, Briefcase, Users, Plus, ChevronRight, BarChart3 } from 'lucide-react'
import { timeAgo, scoreColor } from '@/lib/utils'
import { differenceInDays } from 'date-fns'

export default function RecruiterDashboard() {
  const { data: session } = useSession()

  const { data: jobsData, isLoading } = useQuery({
    queryKey: ['recruiter-jobs'],
    queryFn: () =>
      fetch(`/api/jobs?recruiterId=${session?.user?.id}&status=all&limit=20`).then((r) => r.json()),
    enabled: !!session?.user?.id,
  })

  const jobs: Array<{
    _id: string
    title: string
    status: string
    applicantCount: number
    avgMatchScore: number
    createdAt: string
    location: string
  }> = jobsData?.jobs || []

  const activeJobs = jobs.filter((j) => j.status === 'active').length
  const totalApplicants = jobs.reduce((s, j) => s + (j.applicantCount || 0), 0)

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">
              Welcome, <span className="gradient-text">{session?.user?.name?.split(' ')[0]}</span>
            </h1>
            <p className="text-muted-foreground mt-1">Manage your jobs and pipeline</p>
          </div>
          <Link
            href="/recruiter/jobs/new"
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Post job
          </Link>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Active Jobs', value: activeJobs, icon: Briefcase },
            { label: 'Total Applicants', value: totalApplicants, icon: Users },
            { label: 'Total Jobs', value: jobs.length, icon: BarChart3 },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{label}</span>
                <div className="h-8 w-8 rounded-lg bg-violet-600/20 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-violet-400" />
                </div>
              </div>
              <p className="text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        {/* Jobs list */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Your Jobs</h2>
            <Link href="/recruiter/jobs" className="text-xs text-violet-400 hover:text-violet-300">Manage all</Link>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></div>
          ) : jobs.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <p className="text-muted-foreground mb-4">No jobs posted yet.</p>
              <Link href="/recruiter/jobs/new" className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors">
                Post your first job
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div key={job._id} className="glass rounded-2xl p-5 glow-hover transition-all hover:bg-white/8">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{job.title}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          job.status === 'active' ? 'bg-green-500/15 text-green-400' :
                          job.status === 'paused' ? 'bg-yellow-500/15 text-yellow-400' :
                          'bg-gray-500/15 text-gray-400'
                        }`}>
                          {job.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{job.location} · {timeAgo(job.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {job.applicantCount || 0}
                      </span>
                      {job.avgMatchScore > 0 && (
                        <span className={`text-xs font-bold ${scoreColor(job.avgMatchScore)}`}>
                          avg {job.avgMatchScore}%
                        </span>
                      )}
                      <span className="text-xs">{differenceInDays(new Date(), new Date(job.createdAt))}d</span>
                      <div className="flex gap-2">
                        <Link
                          href={`/recruiter/jobs/${job._id}/graph`}
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5 transition-colors"
                        >
                          Graph
                        </Link>
                        <Link
                          href={`/recruiter/jobs/${job._id}/pipeline`}
                          className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-300 hover:bg-violet-500/20 transition-colors"
                        >
                          Pipeline
                        </Link>
                      </div>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
