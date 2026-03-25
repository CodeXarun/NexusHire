'use client'

import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { JobCard } from '@/components/JobCard'
import { Loader2, Briefcase, FileText, MessageSquare, TrendingUp, ChevronRight } from 'lucide-react'

const STAGE_LABELS: Record<string, string> = {
  applied: 'Applied',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  decision: 'Decision',
  outcome: 'Outcome',
}

const STAGE_COLORS: Record<string, string> = {
  applied: 'text-blue-400',
  under_review: 'text-yellow-400',
  shortlisted: 'text-green-400',
  interview: 'text-purple-400',
  decision: 'text-orange-400',
  outcome: 'text-gray-400',
}

export default function CandidateDashboard() {
  const { data: session } = useSession()

  const { data: profile } = useQuery({
    queryKey: ['candidate-profile'],
    queryFn: () => fetch('/api/candidate/profile').then((r) => r.json()),
  })

  const { data: applications, isLoading: appsLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: () => fetch('/api/applications').then((r) => r.json()),
  })

  const { data: recommendations, isLoading: recsLoading } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => fetch('/api/candidate/recommendations').then((r) => r.json()),
  })

  const apps = Array.isArray(applications) ? applications : []
  const recs = Array.isArray(recommendations) ? recommendations : []
  const recentApps = apps.slice(0, 5)

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">
            Welcome back, <span className="gradient-text">{session?.user?.name?.split(' ')[0]}</span>
          </h1>
          {profile?.profileStrength !== undefined && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 max-w-xs">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Profile strength</span>
                  <span className="text-violet-400 font-medium">{profile.profileStrength}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-600 to-purple-500 transition-all"
                    style={{ width: `${profile.profileStrength}%` }}
                  />
                </div>
              </div>
              {profile.profileStrength < 80 && (
                <Link href="/candidate/profile" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-0.5">
                  Complete profile <ChevronRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Applications', value: apps.length, icon: Briefcase, href: '/candidate/applications' },
            { label: 'Under Review', value: apps.filter((a: { stage: string }) => a.stage === 'under_review').length, icon: TrendingUp, href: '/candidate/applications' },
            { label: 'Interviews', value: apps.filter((a: { stage: string }) => a.stage === 'interview').length, icon: MessageSquare, href: '/candidate/applications' },
            { label: 'Profile', value: `${profile?.profileStrength || 0}%`, icon: FileText, href: '/candidate/profile' },
          ].map(({ label, value, icon: Icon, href }) => (
            <Link href={href} key={label}>
              <div className="glass rounded-2xl p-5 glow-hover transition-all hover:bg-white/8">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <div className="h-8 w-8 rounded-lg bg-violet-600/20 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-violet-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Recent applications */}
          <div className="lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Applications</h2>
              <Link href="/candidate/applications" className="text-xs text-violet-400 hover:text-violet-300">View all</Link>
            </div>
            {appsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-violet-500" /></div>
            ) : recentApps.length === 0 ? (
              <div className="glass rounded-xl p-6 text-center text-sm text-muted-foreground">
                No applications yet.{' '}
                <Link href="/jobs" className="text-violet-400 hover:text-violet-300">Browse jobs →</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentApps.map((app: { _id: string; stage: string; matchScore: number; job?: { title: string; companyName: string } }) => (
                  <Link key={app._id} href={`/candidate/applications`}>
                    <div className="glass rounded-xl p-4 glow-hover transition-all hover:bg-white/8">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{app.job?.title || 'Unknown Role'}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{app.job?.companyName}</p>
                        </div>
                        <span className={`text-xs font-medium shrink-0 ${STAGE_COLORS[app.stage] || 'text-muted-foreground'}`}>
                          {STAGE_LABELS[app.stage] || app.stage}
                        </span>
                      </div>
                      {app.matchScore !== undefined && (
                        <div className="mt-2 h-1 rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-violet-600 transition-all"
                            style={{ width: `${app.matchScore}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recommended for You</h2>
              <Link href="/candidate/jobs" className="text-xs text-violet-400 hover:text-violet-300">View all</Link>
            </div>
            {recsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-violet-500" /></div>
            ) : recs.length === 0 ? (
              <div className="glass rounded-xl p-6 text-center text-sm text-muted-foreground">
                Complete your profile to get AI-powered recommendations.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {recs.slice(0, 4).map((job: Parameters<typeof JobCard>[0]['job']) => (
                  <JobCard key={job._id} job={job} href={`/jobs/${job._id}`} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
