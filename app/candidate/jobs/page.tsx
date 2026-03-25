'use client'

import { useQuery } from '@tanstack/react-query'
import { Navbar } from '@/components/Navbar'
import { JobCard } from '@/components/JobCard'
import { Loader2, Sparkles } from 'lucide-react'

export default function CandidateJobsPage() {
  const { data: recommendations, isLoading } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => fetch('/api/candidate/recommendations').then((r) => r.json()),
  })

  const recs = Array.isArray(recommendations) ? recommendations : []

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-violet-400" />
            <h1 className="text-2xl font-bold">AI Recommendations</h1>
          </div>
          <p className="text-muted-foreground">
            Jobs ranked by semantic similarity to your profile and skills.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : recs.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <p className="text-muted-foreground mb-2">No recommendations yet.</p>
            <p className="text-sm text-muted-foreground">
              Complete your profile and upload your resume to get AI-powered job recommendations.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recs.map((job: Parameters<typeof JobCard>[0]['job']) => (
              <JobCard key={job._id} job={job} href={`/jobs/${job._id}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
