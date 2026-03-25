import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/db'
import Application from '@/lib/models/Application'
import Job from '@/lib/models/Job'
import User from '@/lib/models/User'
import CandidateProfile from '@/lib/models/CandidateProfile'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const app = await Application.findById(params.id).lean() as {
    candidateId: unknown
    jobId: unknown
    [key: string]: unknown
  } | null

  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Access control
  if (session.user.role === 'candidate' && String(app.candidateId) !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [job, user, profile] = await Promise.all([
    Job.findById(app.jobId).lean(),
    User.findById(app.candidateId).select('name email image').lean(),
    CandidateProfile.findOne({ userId: app.candidateId }).select('headline skills profileStrength resumeUrl').lean(),
  ])

  return NextResponse.json({ ...app, job, candidate: { ...user, ...profile } })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'recruiter') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()
  const body = await req.json()
  // Only allow safe fields to be updated via this endpoint
  const allowed: Record<string, unknown> = {}
  if (body.recruiterNotes !== undefined) allowed.recruiterNotes = body.recruiterNotes
  const app = await Application.findByIdAndUpdate(params.id, allowed, { new: true })
  return NextResponse.json(app)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'candidate') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()
  const app = await Application.findOne({ _id: params.id, candidateId: session.user.id }).lean() as { stage: string } | null
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (['decision', 'outcome'].includes(app.stage)) {
    return NextResponse.json({ error: 'Cannot withdraw after decision stage' }, { status: 400 })
  }

  const deleted = await Application.findOneAndDelete({ _id: params.id, candidateId: session.user.id })
  if (deleted) {
    const { default: Job } = await import('@/lib/models/Job')
    await Job.findByIdAndUpdate(deleted.jobId, { $inc: { applicantCount: -1 } })
  }
  return NextResponse.json({ message: 'Application withdrawn' })
}
