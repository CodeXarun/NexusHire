import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/db'
import CandidateProfile from '@/lib/models/CandidateProfile'
import { callGroqJSON, MODELS } from '@/lib/groq'
import { PROMPTS } from '@/lib/ai/prompts'

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'candidate') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { jobDescription } = await req.json()
  if (!jobDescription?.trim()) {
    return NextResponse.json({ error: 'jobDescription is required' }, { status: 400 })
  }

  await connectDB()
  const profile = await CandidateProfile.findOne({ userId: session.user.id }).lean() as Record<string, unknown> | null
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found. Please complete your profile first.' }, { status: 404 })
  }

  // Build a text blob representing the candidate profile
  const skills = (profile.skills as Array<{ skill: string; proficiency: string }> || [])
    .map((s) => `${s.skill} (${s.proficiency})`)
    .join(', ')
  const experience = (profile.experience as Array<{ title: string; company: string; description: string }> || [])
    .map((e) => `${e.title} at ${e.company}: ${e.description}`)
    .join('. ')
  const education = (profile.education as Array<{ degree: string; institution: string }> || [])
    .map((e) => `${e.degree} from ${e.institution}`)
    .join('. ')
  const projects = (profile.projects as Array<{ name: string; description: string; techStack: string[] }> || [])
    .map((p) => `${p.name} (${(p.techStack || []).join(', ')}): ${p.description}`)
    .join('. ')
  const certifications = (profile.certifications as Array<{ title: string }> || [])
    .map((c) => c.title)
    .join(', ')
  const resumeText = [
    profile.headline,
    profile.bio,
    `Skills: ${skills}`,
    `Experience: ${experience}`,
    `Education: ${education}`,
    `Projects: ${projects}`,
    `Certifications: ${certifications}`,
    profile.resumeText,
  ].filter(Boolean).join('\n')

  try {
    const result = await callGroqJSON<{
      atsScore: number
      matchedKeywords: string[]
      missingKeywords: string[]
      feedback: string
    }>(MODELS.FAST, PROMPTS.ATS_CHECK(resumeText, jobDescription))

    return NextResponse.json({
      atsScore: Math.min(100, Math.max(0, Math.round(result.atsScore))),
      matchedKeywords: result.matchedKeywords || [],
      missingKeywords: result.missingKeywords || [],
      feedback: result.feedback || '',
    })
  } catch (err) {
    console.error('ATS check error:', err)
    return NextResponse.json({ error: 'Failed to run ATS check' }, { status: 500 })
  }
}
