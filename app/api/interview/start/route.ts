import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/db'
import InterviewSession from '@/lib/models/InterviewSession'
import Job from '@/lib/models/Job'
import CandidateProfile from '@/lib/models/CandidateProfile'
import { callGroqJSON, MODELS } from '@/lib/groq'
import { PROMPTS } from '@/lib/ai/prompts'

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'candidate') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { jobId } = await req.json()
    await connectDB()

    const [job, profile] = await Promise.all([
      Job.findById(jobId).lean() as Promise<{ title?: string; requiredSkills?: Array<{ skill: string }> } | null>,
      CandidateProfile.findOne({ userId: session.user.id }).lean(),
    ])

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const jobSkills = (job.requiredSkills || []).map((s) => s.skill)
    const prompt = PROMPTS.INTERVIEW_START(job.title || 'Software Engineer', jobSkills)

    const result = await callGroqJSON<{ question: string; context?: string }>(MODELS.SMART, prompt)

    const interviewSession = await InterviewSession.create({
      candidateId: session.user.id,
      jobId,
      messages: [{ role: 'interviewer', content: result.question, timestamp: new Date() }],
      status: 'active',
    })

    return NextResponse.json({ sessionId: interviewSession._id, question: result.question })
  } catch (err) {
    console.error('Interview start error:', err)
    return NextResponse.json({ error: 'Failed to start interview' }, { status: 500 })
  }
}
