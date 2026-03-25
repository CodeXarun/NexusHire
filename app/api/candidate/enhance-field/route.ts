import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { callGroqJSON, MODELS } from '@/lib/groq'
import { PROMPTS } from '@/lib/ai/prompts'

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'candidate') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { type, items, projectName, techStack } = await req.json()

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items array is required' }, { status: 400 })
  }

  try {
    if (type === 'project') {
      const result = await callGroqJSON<{ enhanced: string[] }>(
        MODELS.SMART,
        PROMPTS.ENHANCE_PROJECT_BULLETS(projectName || 'Project', items, techStack || '')
      )
      return NextResponse.json({ enhanced: result.enhanced || items })
    }

    // Default: achievements
    const result = await callGroqJSON<{ enhanced: string[] }>(
      MODELS.SMART,
      PROMPTS.ENHANCE_ACHIEVEMENTS(items)
    )
    return NextResponse.json({ enhanced: result.enhanced || items })
  } catch (err) {
    console.error('Enhance field error:', err)
    return NextResponse.json({ error: 'Enhancement failed' }, { status: 500 })
  }
}
