import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { callGroqJSON, MODELS } from '@/lib/groq'
import { PROMPTS } from '@/lib/ai/prompts'

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'candidate') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { skills } = await req.json()
  if (!Array.isArray(skills) || skills.length === 0) {
    return NextResponse.json({ error: 'skills array is required' }, { status: 400 })
  }

  try {
    const result = await callGroqJSON<{
      languages: string[]
      frameworks: string[]
      tools: string[]
      soft: string[]
    }>(MODELS.FAST, PROMPTS.CATEGORIZE_SKILLS(skills))

    return NextResponse.json({
      languages: result.languages || [],
      frameworks: result.frameworks || [],
      tools: result.tools || [],
      soft: result.soft || [],
    })
  } catch (err) {
    console.error('Categorize skills error:', err)
    return NextResponse.json({ error: 'Failed to categorize skills' }, { status: 500 })
  }
}
