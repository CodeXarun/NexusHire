import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Job from '@/lib/models/Job'
import { generateEmbedding } from '@/lib/nim'
import { callGroqJSON, MODELS } from '@/lib/groq'
import mongoose from 'mongoose'

interface ParsedIntent {
  skills?: string[]
  location?: string
  locationType?: string
  roleLevel?: string
  keywords?: string[]
}

async function parseSearchIntent(query: string): Promise<ParsedIntent> {
  const prompt = `Extract job search intent from this query as JSON with no markdown.
Query: "${query}"
Return: { "skills": [], "location": "", "locationType": null, "roleLevel": null, "keywords": [] }`
  try {
    return await callGroqJSON<ParsedIntent>(MODELS.FAST, prompt)
  } catch {
    return { keywords: [query] }
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 12
  const manualLocationType = searchParams.get('locationType')
  const manualRoleLevel = searchParams.get('roleLevel')

  await connectDB()

  if (!q.trim()) {
    const filter: Record<string, unknown> = { status: 'active' }
    if (manualLocationType) filter.locationType = manualLocationType
    if (manualRoleLevel) filter.roleLevel = manualRoleLevel
    const jobs = await Job.find(filter).sort({ createdAt: -1 }).limit(limit).lean()
    return NextResponse.json({ jobs, total: jobs.length, pages: 1 })
  }

  // Generate embedding for the query
  let embedding: number[] = []
  try {
    embedding = await generateEmbedding(q)
  } catch {
    console.warn('Search embedding failed — falling back to text search')
  }

  // Parse intent for additional filters
  const intent = await parseSearchIntent(q)
  const locationType = manualLocationType || intent.locationType || null
  const roleLevel = manualRoleLevel || intent.roleLevel || null

  if (embedding.length) {
    try {
      // Atlas Vector Search aggregation
      const pipeline: mongoose.PipelineStage[] = [
        {
          $vectorSearch: {
            index: 'jobs_vector_index',
            path: 'embedding',
            queryVector: embedding,
            numCandidates: 150,
            limit: 50,
          },
        } as mongoose.PipelineStage,
        {
          $addFields: {
            _vectorScore: { $meta: 'vectorSearchScore' },
          },
        },
        {
          $match: {
            status: 'active',
            ...(locationType ? { locationType } : {}),
            ...(roleLevel ? { roleLevel } : {}),
            ...(intent.location ? { location: { $regex: intent.location, $options: 'i' } } : {}),
          },
        },
        { $sort: { _vectorScore: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ]

      const db = mongoose.connection.db!
      const results = await db.collection('jobs').aggregate(pipeline).toArray()
      const total = results.length + (page - 1) * limit

      return NextResponse.json({
        jobs: results.map((j) => ({ ...j, _id: j._id.toString(), _score: j._vectorScore })),
        total,
        pages: Math.ceil(total / limit),
      })
    } catch (err) {
      console.warn('Atlas Vector Search failed, falling back to in-memory:', err)
      // Fall through to text search below
    }
  }

  // Text search fallback
  const textFilter: Record<string, unknown> = {
    status: 'active',
    $or: [
      { title: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { 'requiredSkills.skill': { $regex: q, $options: 'i' } },
    ],
  }
  if (locationType) textFilter.locationType = locationType
  if (roleLevel) textFilter.roleLevel = roleLevel

  const textJobs = await Job.find(textFilter).limit(limit).lean()
  return NextResponse.json({ jobs: textJobs, total: textJobs.length, pages: 1 })
}
