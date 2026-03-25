import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/db'
import InterviewSession from '@/lib/models/InterviewSession'
import Job from '@/lib/models/Job'
import { callGroqJSON, MODELS } from '@/lib/groq'
import { PROMPTS } from '@/lib/ai/prompts'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const interview = await InterviewSession.findOne({ _id: params.id, candidateId: session.user.id })
  if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (interview.feedbackReport) return NextResponse.json(interview.feedbackReport)
  if (interview.status !== 'completed') return NextResponse.json({ error: 'Interview not completed' }, { status: 400 })

  const job = await Job.findById(interview.jobId).select('title').lean() as { title?: string } | null

  try {
    const prompt = PROMPTS.INTERVIEW_REPORT(
      job?.title || 'Software Engineer',
      interview.messages.map((m: { role: string; content: string; score?: number }) => m)
    )

    interface Report {
      overallScore: number
      strongestAnswer: string
      weakestAnswer: string
      improvementTips: string[]
      summary: string
    }
    const report = await callGroqJSON<Report>(MODELS.SMART, prompt)

    // Calculate average score from candidate answers
    const scores = interview.messages
      .filter((m: { role: string; score?: number }) => m.role === 'candidate' && m.score !== undefined)
      .map((m: { score?: number }) => m.score ?? 0)
    if (scores.length) {
      report.overallScore = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length * 10)
    }

    interview.feedbackReport = report
    await interview.save()

    return NextResponse.json(report)
  } catch (err) {
    console.error('Report error:', err)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
