'use client'

import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Navbar } from '@/components/Navbar'
import Link from 'next/link'
import { toast } from 'sonner'
import { Plus, Loader2, Pencil, Network, Kanban, Trash2, Users } from 'lucide-react'
import { timeAgo } from '@/lib/utils'

export default function RecruiterJobsPage() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  const { data: jobsData, isLoading } = useQuery({
    queryKey: ['recruiter-jobs'],
    queryFn: () =>
      fetch(`/api/jobs?recruiterId=${session?.user?.id}&status=all&limit=50`).then((r) => r.json()),
    enabled: !!session?.user?.id,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruiter-jobs'] })
      toast.success('Job status updated')
    },
  })

  const jobs = jobsData?.jobs || []

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">My Jobs</h1>
          <Link
            href="/recruiter/jobs/new"
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Post new job
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>
        ) : jobs.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <p className="text-muted-foreground mb-4">No jobs posted yet.</p>
            <Link href="/recruiter/jobs/new" className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors">
              Post your first job
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job: {
              _id: string
              title: string
              location: string
              locationType: string
              status: string
              applicantCount: number
              createdAt: string
            }) => (
              <div key={job._id} className="glass rounded-2xl p-5">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{job.title}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        job.status === 'active' ? 'bg-green-500/15 text-green-400' :
                        job.status === 'paused' ? 'bg-yellow-500/15 text-yellow-400' :
                        'bg-gray-500/15 text-gray-400'
                      }`}>
                        {job.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {job.location} · {job.locationType} · {timeAgo(job.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{job.applicantCount || 0} applicants</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Status toggle */}
                    <select
                      value={job.status}
                      onChange={(e) => updateStatus.mutate({ id: job._id, status: e.target.value })}
                      className="rounded-lg border border-white/10 bg-[hsl(0,0%,6%)] px-3 py-1.5 text-xs focus:outline-none"
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="closed">Closed</option>
                      <option value="draft">Draft</option>
                    </select>

                    <Link
                      href={`/recruiter/jobs/${job._id}/edit`}
                      className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Link>

                    <Link
                      href={`/recruiter/jobs/${job._id}/graph`}
                      className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5 transition-colors"
                    >
                      <Network className="h-3.5 w-3.5" />
                      Graph
                    </Link>

                    <Link
                      href={`/recruiter/jobs/${job._id}/pipeline`}
                      className="flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-300 hover:bg-violet-500/20 transition-colors"
                    >
                      <Kanban className="h-3.5 w-3.5" />
                      Pipeline
                    </Link>
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
