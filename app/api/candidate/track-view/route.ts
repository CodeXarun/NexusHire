import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/db'
import CandidateProfile from '@/lib/models/CandidateProfile'
import Job from '@/lib/models/Job'

// POST /api/candidate/track-view  { jobId: string }
// Records a job view and stores the job's skills in the candidate's interaction history
export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'candidate') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { jobId } = await req.json()
  if (!jobId) return NextResponse.json({ ok: true })

  await connectDB()

  const job = await Job.findById(jobId).select('requiredSkills').lean() as { requiredSkills?: Array<{ skill: string }> } | null
  if (!job) return NextResponse.json({ ok: true })

  const skills = (job.requiredSkills ?? []).map((s) => s.skill)

  // Push viewed skills into recentInteractionSkills (capped at 50)
  await CandidateProfile.findOneAndUpdate(
    { userId: session.user.id },
    {
      $push: {
        recentInteractionSkills: {
          $each: skills,
          $slice: -50,
        },
      },
    }
  )

  return NextResponse.json({ ok: true })
}
