import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { callGroqJSON, MODELS } from '@/lib/groq'
import { PROMPTS } from '@/lib/ai/prompts'

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'candidate') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { bullet, targetRole } = await req.json()
  if (!bullet?.trim()) {
    return NextResponse.json({ error: 'bullet text is required' }, { status: 400 })
  }

  try {
    const result = await callGroqJSON<{
      improved: string[]
      keywords: string[]
      feedback: string
    }>(MODELS.SMART, PROMPTS.IMPROVE_BULLET(bullet, targetRole || 'Software Engineer'))

    return NextResponse.json({
      improved: result.improved || [],
      keywords: result.keywords || [],
      feedback: result.feedback || '',
    })
  } catch (err) {
    console.error('Improve bullet error:', err)
    return NextResponse.json({ error: 'Failed to improve bullet' }, { status: 500 })
  }
}
