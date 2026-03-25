import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/db'
import Job from '@/lib/models/Job'
import CandidateProfile from '@/lib/models/CandidateProfile'
import Application from '@/lib/models/Application'
import { cosineSimilarity, generateEmbedding } from '@/lib/nim'
import { decomposeJD } from '@/lib/ai/decomposeJD'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  await connectDB()
  const job = await Job.findById(params.id).lean() as (Record<string, unknown> & { embedding?: number[] }) | null
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  // If candidate is logged in, attach pre-computed match score + applied status
  if (session?.user?.role === 'candidate') {
    const [profile, existing] = await Promise.all([
      CandidateProfile.findOne({ userId: session.user.id }).select('embedding').lean() as Promise<{ embedding?: number[] } | null>,
      Application.findOne({ candidateId: session.user.id, jobId: params.id }).select('_id').lean(),
    ])
    let preMatchScore: number | undefined
    if (profile?.embedding?.length && job.embedding?.length) {
      preMatchScore = Math.round(cosineSimilarity(profile.embedding, job.embedding as number[]) * 100)
    }
    return NextResponse.json({ ...job, _preMatchScore: preMatchScore, _alreadyApplied: !!existing })
  }

  return NextResponse.json(job)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'recruiter') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()
  const body = await req.json()
  const { reDecompose, ...fields } = body

  // Re-decompose JD and regenerate embedding on demand
  if (reDecompose && fields.description) {
    try {
      const decomposed = await decomposeJD(fields.description)
      fields.requiredSkills = decomposed.requiredSkills
      fields.cultureTags = decomposed.cultureTags
      fields.roleLevel = decomposed.roleLevel
      fields.experienceRange = decomposed.experienceRange
    } catch {
      console.warn('Re-decompose failed, keeping existing skills')
    }
    try {
      const skillsText = (fields.requiredSkills || []).map((s: { skill: string }) => s.skill).join(', ')
      const embeddingText = `${fields.title || ''} ${skillsText} ${fields.description}`
      fields.embedding = await generateEmbedding(embeddingText)
    } catch {
      console.warn('Embedding regeneration failed')
    }
  }

  const job = await Job.findOneAndUpdate(
    { _id: params.id, recruiterId: session.user.id },
    fields,
    { new: true }
  )
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  return NextResponse.json(job)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'recruiter') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()
  await Job.findOneAndDelete({ _id: params.id, recruiterId: session.user.id })
  return NextResponse.json({ message: 'Job deleted' })
}
