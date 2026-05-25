import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/db'
import CandidateProfile from '@/lib/models/CandidateProfile'
import { callGroqJSON, MODELS } from '@/lib/groq'
import { PROMPTS } from '@/lib/ai/prompts'
import pdfParse from 'pdf-parse'

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'candidate') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let jobDescription = ''
  let pdfBase64 = ''

  try {
    const body = await req.json()
    jobDescription = body.jobDescription || ''
    pdfBase64 = body.pdfBase64 || ''
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Validate job description length/quality if provided
  if (jobDescription.trim()) {
    const wordCount = jobDescription.trim().split(/\s+/).length
    if (wordCount < 10) {
      return NextResponse.json({
        atsScore: 0,
        matchedKeywords: [],
        missingKeywords: [],
        feedback: 'Invalid JD: The provided text is too short or appears to be random words. Please provide a complete job description.',
      })
    }
  }

  await connectDB()
  let profile = await CandidateProfile.findOne({ userId: session.user.id }).lean() as Record<string, unknown> | null
  if (!profile && !pdfBase64) {
    return NextResponse.json({ error: 'Profile not found and no PDF uploaded. Please complete your profile or upload a resume.' }, { status: 404 })
  }

  let resumeText = ''

  if (pdfBase64) {
    try {
      const buffer = Buffer.from(pdfBase64, 'base64')
      const parsed = await pdfParse(buffer)
      resumeText = parsed.text
      
      if (!resumeText || !resumeText.trim()) {
        return NextResponse.json({ error: 'Uploaded PDF contains no readable text. It might be an image-based PDF.' }, { status: 400 })
      }
    } catch (err: any) {
      console.error('PDF parse error:', err)
      return NextResponse.json({ error: `Failed to parse the uploaded PDF: ${err.message || 'Unknown error'}` }, { status: 400 })
    }
  } else if (profile) {
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
    resumeText = [
      profile.headline,
      profile.bio,
      `Skills: ${skills}`,
      `Experience: ${experience}`,
      `Education: ${education}`,
      `Projects: ${projects}`,
      `Certifications: ${certifications}`,
      profile.resumeText,
    ].filter(Boolean).join('\n')
  }

  try {
    let promptText = ''
    if (jobDescription.trim()) {
      promptText = PROMPTS.ATS_CHECK(resumeText, jobDescription)
    } else {
      promptText = PROMPTS.RESUME_QUALITY_CHECK(resumeText)
    }

    const result = await callGroqJSON<{
      atsScore: number
      matchedKeywords: string[]
      missingKeywords: string[]
      feedback: string
    }>(MODELS.FAST, promptText)

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
