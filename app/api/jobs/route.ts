import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/db'
import Job from '@/lib/models/Job'
import CompanyProfile from '@/lib/models/CompanyProfile'
import { decomposeJD } from '@/lib/ai/decomposeJD'
import { generateEmbedding } from '@/lib/nim'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '12')
  const status = searchParams.get('status') || 'active'
  const recruiterId = searchParams.get('recruiterId')

  await connectDB()

  const locationType = searchParams.get('locationType')
  const roleLevel = searchParams.get('roleLevel')

  const query: Record<string, unknown> = {}
  if (status !== 'all') query.status = status
  if (recruiterId) query.recruiterId = recruiterId
  if (locationType) query.locationType = locationType
  if (roleLevel) query.roleLevel = roleLevel

  const [jobs, total] = await Promise.all([
    Job.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Job.countDocuments(query),
  ])

  return NextResponse.json({ jobs, total, page, pages: Math.ceil(total / limit) })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'recruiter') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    await connectDB()

    const company = await CompanyProfile.findOne({ userId: session.user.id }).lean() as { companyName?: string; industry?: string } | null

    // AI decompose JD
    let decomposed: Awaited<ReturnType<typeof decomposeJD>> | null = null
    try {
      decomposed = await decomposeJD(body.description || '')
    } catch {
      console.warn('JD decomposition failed')
    }

    const requiredSkills = decomposed?.requiredSkills || body.requiredSkills || []
    const cultureTags = decomposed?.cultureTags || body.cultureTags || []

    // Generate embedding
    const skillsText = requiredSkills.map((s: { skill: string }) => s.skill).join(', ')
    const embeddingText = `${body.title} ${skillsText} ${body.description || ''}`
    let embedding: number[] = []
    try {
      embedding = await generateEmbedding(embeddingText)
    } catch {
      console.warn('Job embedding failed')
    }

    const job = await Job.create({
      recruiterId: session.user.id,
      companyName: company?.companyName || 'Unknown Company',
      title: body.title,
      description: body.description,
      location: body.location,
      locationType: body.locationType || 'hybrid',
      employmentType: body.employmentType || 'full-time',
      experienceRange: body.experienceRange || { min: 0, max: 5 },
      roleLevel: body.roleLevel || 'mid',
      salaryRange: body.salaryRange,
      requiredSkills,
      cultureTags,
      embedding,
      status: body.status || 'active',
    })

    return NextResponse.json(job, { status: 201 })
  } catch (err) {
    console.error('Job creation error:', err)
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
  }
}
