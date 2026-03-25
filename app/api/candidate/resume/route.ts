import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/db'
import CandidateProfile from '@/lib/models/CandidateProfile'
import { uploadResume } from '@/lib/s3'
import { parseResume } from '@/lib/ai/parseResume'
import { generateEmbedding } from '@/lib/nim'
import pdf from 'pdf-parse'

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'candidate') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('resume') as File
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // Upload to S3
    const s3Key = `resumes/${session.user.id}/${Date.now()}-${file.name}`
    await uploadResume(buffer, s3Key, file.type)

    // Parse PDF text
    let extractedText = ''
    try {
      const pdfData = await pdf(buffer)
      extractedText = pdfData.text
    } catch {
      console.warn('PDF parse failed')
    }

    // AI parse resume with Groq
    let parsed: Awaited<ReturnType<typeof parseResume>> | null = null
    if (extractedText) {
      try {
        parsed = await parseResume(extractedText)
      } catch {
        console.warn('AI parse failed')
      }
    }

    await connectDB()

    // Build update data — map parsed output to DB schema correctly
    const updateData: Record<string, unknown> = {
      resumeS3Key: s3Key,   // Store the S3 key in the correct schema field
    }

    if (parsed) {
      // DB schema uses {skill, proficiency} — map from parsed {skill, proficiency}
      if (parsed.skills?.length) {
        updateData.skills = parsed.skills.map((s) => ({
          skill: s.skill,
          proficiency: s.proficiency || 'intermediate',
          yearsOfExp: s.yearsOfExp,
        }))
      }
      if (parsed.experience?.length) updateData.experience = parsed.experience
      if (parsed.education?.length) updateData.education = parsed.education
      if (parsed.headline) updateData.headline = parsed.headline
      if (parsed.location) updateData.location = parsed.location
      if (parsed.githubUrl) updateData.githubUrl = parsed.githubUrl
      if (parsed.portfolioUrl) updateData.portfolioUrl = parsed.portfolioUrl
      if (parsed.linkedinUrl) updateData.linkedinUrl = parsed.linkedinUrl
      if (parsed.improvementTips?.length) updateData.resumeImprovementTips = parsed.improvementTips

      // Store raw resume text for re-embedding later
      updateData.resumeText = extractedText
    }

    // Generate NVIDIA NIM embedding from parsed profile text
    // This is what powers the Opportunity Graph!
    let embedding: number[] = []
    try {
      const skillsText = parsed?.skills?.map((s) => s.skill).join(', ') ?? ''
      const expText = parsed?.experience
        ?.map((e) => `${e.title} at ${e.company}: ${e.description}`)
        .join('. ') ?? ''
      const textBlob = `${parsed?.headline ?? ''} ${skillsText} ${expText}`.trim()

      if (textBlob) {
        embedding = await generateEmbedding(textBlob)
        updateData.embedding = embedding
      }
    } catch {
      console.warn('NIM embedding failed during resume upload')
    }

    // Calculate profile strength
    let profileStrength = 20 // Base for having a resume
    if (parsed?.skills?.length) profileStrength += 20
    if (parsed?.experience?.length) profileStrength += 25
    if (parsed?.education?.length) profileStrength += 15
    if (parsed?.headline) profileStrength += 10
    if (parsed?.githubUrl || parsed?.portfolioUrl) profileStrength += 10
    updateData.profileStrength = Math.min(profileStrength, 100)

    const profile = await CandidateProfile.findOneAndUpdate(
      { userId: session.user.id },
      updateData,
      { new: true, upsert: true }
    )

    return NextResponse.json({
      s3Key,
      parsed,
      profile,
      improvementTips: parsed?.improvementTips ?? [],
      embeddingGenerated: embedding.length > 0,
    })
  } catch (err) {
    console.error('Resume upload error:', err)
    return NextResponse.json({ error: 'Failed to process resume' }, { status: 500 })
  }
}
