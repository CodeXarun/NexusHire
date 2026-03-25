import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/db'
import Application from '@/lib/models/Application'
import Job from '@/lib/models/Job'
import User from '@/lib/models/User'
import CandidateProfile from '@/lib/models/CandidateProfile'

export async function GET(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'recruiter') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId')
  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
  }

  await connectDB()

  // Verify recruiter owns this job
  const job = await Job.findOne({ _id: jobId, recruiterId: session.user.id }).lean()
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const applications = await Application.find({ jobId }).lean() as Array<Record<string, unknown>>
  if (applications.length === 0) {
    return NextResponse.json({ topCandidate: null, candidates: [] })
  }

  // Enrich with candidate info
  const enriched = await Promise.all(
    applications.map(async (app) => {
      const [user, profile] = await Promise.all([
        User.findById(app.candidateId).select('name email image').lean() as Promise<Record<string, unknown> | null>,
        CandidateProfile.findOne({ userId: app.candidateId }).select('headline skills').lean() as Promise<Record<string, unknown> | null>,
      ])
      const rawScore = app.matchScore as { overall?: number } | number | undefined
      const matchScore = rawScore && typeof rawScore === 'object'
        ? (rawScore.overall ?? 0)
        : (rawScore as number) ?? 0

      return {
        _id: String(app._id),
        name: String((user?.name as string) || 'Anonymous'),
        email: String((user?.email as string) || ''),
        image: (user?.image as string) || null,
        headline: (profile?.headline as string) || '',
        skills: (profile?.skills as Array<{ skill: string }> || []).map((s) => s.skill),
        matchScore,
        stage: app.stage,
        outcome: app.outcome,
      }
    })
  )

  // Sort by matchScore descending
  enriched.sort((a, b) => b.matchScore - a.matchScore)

  const topCandidate = enriched[0]
  const topScore = topCandidate.matchScore

  const candidates = enriched.map((c) => ({
    ...c,
    gap: parseFloat((topScore - c.matchScore).toFixed(1)),
    isTop: c._id === topCandidate._id,
  }))

  return NextResponse.json({ topCandidate, candidates })
}
