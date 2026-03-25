import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/db'
import CandidateProfile from '@/lib/models/CandidateProfile'
import User from '@/lib/models/User'
import { generateEmbedding } from '@/lib/nim'
import { getResumeSignedUrl } from '@/lib/s3'

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== 'candidate') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await connectDB()
  const profile = await CandidateProfile.findOne({ userId: session.user.id }).lean() as Record<string, unknown> | null
  if (!profile) return NextResponse.json({})

  const user = await User.findById(session.user.id).select('name').lean() as { name?: string } | null
  if (user?.name) {
    profile.name = user.name
  }

  // Convert stored S3 key to a pre-signed URL so the frontend can display a download link
  if (profile.resumeS3Key && typeof profile.resumeS3Key === 'string') {
    try {
      profile.resumeUrl = await getResumeSignedUrl(profile.resumeS3Key)
    } catch {
      // S3 not configured or key invalid — just omit the URL
      profile.resumeUrl = null
    }
  }

  return NextResponse.json(profile)
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'candidate') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    await connectDB()

    // Map form skills {name, level} → schema skills {skill, proficiency}
    const skills = (body.skills || []).map((s: { name?: string; skill?: string; level?: string; proficiency?: string }) => ({
      skill: s.skill || s.name || '',
      proficiency: s.proficiency || s.level || 'intermediate',
    }))

    // Map socialLinks object → individual URL fields
    const socialLinks = body.socialLinks || {}
    const githubUrl = socialLinks.github || body.githubUrl || ''
    const linkedinUrl = socialLinks.linkedin || body.linkedinUrl || ''
    const portfolioUrl = socialLinks.portfolio || body.portfolioUrl || ''
    const tryhackmeUrl = socialLinks.tryhackme || body.tryhackmeUrl || ''

    // skillGroups: [{category, skills}] — sync flat skills array from skillGroups if provided
    const skillGroups = (body.skillGroups || []).map((g: { category: string; skills: string[] | string }) => ({
      category: g.category || '',
      skills: Array.isArray(g.skills) ? g.skills : String(g.skills).split(',').map((s: string) => s.trim()).filter(Boolean),
    }))

    // If skillGroups provided, sync flat skills list from them (for embedding/matching)
    if (skillGroups.length > 0 && skills.length === 0) {
      const allFromGroups = skillGroups.flatMap((g: { skills: string[] }) => g.skills)
      allFromGroups.forEach((sk: string) => {
        skills.push({ skill: sk, proficiency: 'intermediate' })
      })
    }

    // Build embedding text
    const skillsText = skills.map((s: { skill: string }) => s.skill).join(', ')
    const expText = (body.experience || [])
      .map((e: { title: string; company: string; description: string }) => `${e.title} at ${e.company}: ${e.description}`)
      .join('. ')
    const textBlob = `${body.headline || ''} ${skillsText} ${expText} ${body.bio || ''}`

    let embedding: number[] = []
    try {
      embedding = await generateEmbedding(textBlob)
    } catch {
      console.warn('Embedding generation failed, skipping')
    }

    // Calculate profile strength
    let strength = 0
    if (body.headline) strength += 10
    if (body.bio) strength += 10
    if (skills.length > 0) strength += 20
    if ((body.experience || []).length > 0) strength += 25
    if ((body.education || []).length > 0) strength += 15
    if ((body.projects || []).length > 0) strength += 10

    if (body.name) {
      await User.findByIdAndUpdate(session.user.id, { name: body.name })
    }

    const profile = await CandidateProfile.findOneAndUpdate(
      { userId: session.user.id },
      {
        headline: body.headline || '',
        bio: body.bio || '',
        location: body.location || '',
        phone: body.phone || '',
        skills,
        skillGroups,
        experience: body.experience || [],
        education: body.education || [],
        projects: body.projects || [],
        certifications: body.certifications || [],
        achievements: body.achievements || [],
        githubUrl,
        linkedinUrl,
        portfolioUrl,
        tryhackmeUrl,
        embedding,
        profileStrength: strength,
      },
      { new: true, upsert: true }
    )

    return NextResponse.json(profile)
  } catch (err) {
    console.error('Profile update error:', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
