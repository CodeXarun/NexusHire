import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/db'
import CandidateProfile from '@/lib/models/CandidateProfile'
import { callGroqJSON, MODELS } from '@/lib/groq'
import { PROMPTS } from '@/lib/ai/prompts'

export async function POST() {
  const session = await auth()
  if (!session || session.user.role !== 'candidate') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()
  const profile = await CandidateProfile.findOne({ userId: session.user.id }).lean() as Record<string, unknown> | null
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found. Please complete your profile first.' }, { status: 404 })
  }

  const trimmedProfile = {
    headline: profile.headline,
    skills: (profile.skills as Array<{ skill: string; proficiency: string }> || [])
      .map((s) => `${s.skill} (${s.proficiency})`),
    experience: (profile.experience as Array<{ title: string; company: string; startDate: string; endDate?: string; description: string }> || [])
      .map((e) => ({ title: e.title, company: e.company, duration: `${e.startDate} – ${e.endDate || 'Present'}`, description: e.description?.slice(0, 100) })),
    education: profile.education,
    location: profile.location,
  }

  try {
    const result = await callGroqJSON<{ summary: string }>(
      MODELS.SMART,
      PROMPTS.GENERATE_SUMMARY(trimmedProfile)
    )

    return NextResponse.json({ summary: result.summary || '' })
  } catch (err) {
    console.error('Generate summary error:', err)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
