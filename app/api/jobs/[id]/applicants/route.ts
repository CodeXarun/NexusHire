import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/db'
import Application from '@/lib/models/Application'
import Job from '@/lib/models/Job'
import User from '@/lib/models/User'
import CandidateProfile from '@/lib/models/CandidateProfile'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'recruiter') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()

  const job = await Job.findOne({ _id: params.id, recruiterId: session.user.id }).lean()
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const applications = await Application.find({ jobId: params.id })
    .sort({ matchScore: -1 })
    .lean() as Array<{ candidateId: unknown; [key: string]: unknown }>

  // Enrich with candidate info
  const enriched = await Promise.all(
    applications.map(async (app) => {
      const [user, profile] = await Promise.all([
        User.findById(app.candidateId).select('name email image').lean(),
        CandidateProfile.findOne({ userId: app.candidateId })
          .select('headline skills profileStrength resumeS3Key')
          .lean(),
      ])
      const rawScore = app.matchScore as { overall?: number } | number | undefined
      const matchScore =
        rawScore && typeof rawScore === 'object'
          ? (rawScore.overall ?? 0)
          : (rawScore as number) ?? 0
      return {
        ...app,
        candidate: { ...user, ...profile },
        matchScore,
        breakdown: (app as { breakdown?: unknown[] }).breakdown ?? [],
      }
    })
  )

  return NextResponse.json(enriched)
}
