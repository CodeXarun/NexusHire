import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/db'
import InterviewSession from '@/lib/models/InterviewSession'
import Job from '@/lib/models/Job'
import { callGroqJSON, MODELS } from '@/lib/groq'
import { PROMPTS } from '@/lib/ai/prompts'

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'candidate') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { sessionId, answer } = await req.json()
    await connectDB()

    const interview = await InterviewSession.findOne({
      _id: sessionId,
      candidateId: session.user.id,
      status: 'active',
    })

    if (!interview) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const job = await Job.findById(interview.jobId).select('title').lean() as { title?: string } | null

    // Save candidate answer
    interview.messages.push({ role: 'candidate', content: answer, timestamp: new Date() })

    const history = interview.messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    }))

    const roundNumber = Math.floor(interview.messages.length / 2)
    const isLastRound = roundNumber >= 5

    const prompt = PROMPTS.INTERVIEW_RESPOND(job?.title || 'Software Engineer', history, answer)

    interface InterviewResult {
      evaluation: { score: number; feedback: string }
      nextQuestion: string | null
      isComplete: boolean
    }
    const result = await callGroqJSON<InterviewResult>(MODELS.SMART, prompt)

    const lastMsg = interview.messages[interview.messages.length - 1]
    lastMsg.score = result.evaluation?.score
    lastMsg.feedback = result.evaluation?.feedback

    const complete = result.isComplete || isLastRound

    if (!complete && result.nextQuestion) {
      interview.messages.push({ role: 'interviewer', content: result.nextQuestion, timestamp: new Date() })
    }
    if (complete) interview.status = 'completed'

    await interview.save()

    return NextResponse.json({
      score: result.evaluation?.score,
      feedback: result.evaluation?.feedback,
      nextQuestion: complete ? null : result.nextQuestion,
      isComplete: complete,
    })
  } catch (err) {
    console.error('Interview respond error:', err)
    return NextResponse.json({ error: 'Failed to process response' }, { status: 500 })
  }
}
