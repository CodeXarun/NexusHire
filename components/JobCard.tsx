import Link from 'next/link'
import { MapPin, Clock, DollarSign, Users, Zap } from 'lucide-react'
import { formatSalary, scoreColor, scoreBg } from '@/lib/utils'

interface Job {
  _id: string
  title: string
  companyName: string
  location: string
  locationType: string
  employmentType: string
  salaryRange?: { min: number; max: number; currency: string }
  requiredSkills: Array<{ skill: string; weight: number }>
  applicantCount?: number
  createdAt?: string
  _matchScore?: number
}

export function JobCard({ job, href }: { job: Job; href?: string }) {
  const url = href || `/jobs/${job._id}`

  return (
    <Link href={url} className="block">
      <div className="glass rounded-2xl p-5 glow-hover gradient-border transition-all hover:bg-white/8">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{job.title}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{job.companyName}</p>
          </div>
          {job._matchScore !== undefined && (
            <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${scoreBg(job._matchScore)} ${scoreColor(job._matchScore)}`}>
              <Zap className="h-3 w-3" />
              {job._matchScore}%
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {job.location}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {job.locationType}
          </span>
          {job.salaryRange && (
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              {formatSalary(job.salaryRange.min, job.salaryRange.currency)} – {formatSalary(job.salaryRange.max, job.salaryRange.currency)}
            </span>
          )}
          {job.applicantCount !== undefined && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {job.applicantCount} applicants
            </span>
          )}
        </div>

        {job.requiredSkills?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {job.requiredSkills.slice(0, 4).map((s) => (
              <span
                key={s.skill}
                className="rounded-md border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300"
              >
                {s.skill}
              </span>
            ))}
            {job.requiredSkills.length > 4 && (
              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">
                +{job.requiredSkills.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
