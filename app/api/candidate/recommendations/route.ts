import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/db'
import CandidateProfile from '@/lib/models/CandidateProfile'
import Application from '@/lib/models/Application'
import mongoose from 'mongoose'

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== 'candidate') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()

  const profile = await CandidateProfile.findOne({ userId: session.user.id })
    .select('embedding recentInteractionSkills')
    .lean() as { embedding?: number[]; recentInteractionSkills?: string[] } | null

  if (!profile?.embedding?.length || profile.embedding.every((v) => v === 0)) {
    // No embedding yet (or all zeros) — return recent active jobs so graph isn't empty
    const db = mongoose.connection.db!
    const jobs = await db.collection('jobs')
      .find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray()
    return NextResponse.json(
      jobs.map((j) => ({ ...j, _id: j._id.toString(), _matchScore: 0 }))
    )
  }

  // Get already-applied job IDs to exclude
  const applied = await Application.find({ candidateId: session.user.id })
    .select('jobId')
    .lean() as { jobId: unknown }[]
  const appliedIds = applied.map((a) => String(a.jobId))

  try {
    // Atlas Vector Search — find top jobs matching the candidate's profile embedding
    const pipeline: mongoose.PipelineStage[] = [
      {
        $vectorSearch: {
          index: 'jobs_vector_index',
          path: 'embedding',
          queryVector: profile.embedding,
          numCandidates: 100,
          limit: 20,
        },
      } as mongoose.PipelineStage,
      {
        $addFields: {
          _vectorScore: { $meta: 'vectorSearchScore' },
        },
      },
      {
        $match: { status: 'active' },
      },
      { $sort: { _vectorScore: -1 } },
      { $limit: 10 },
    ]

    const db = mongoose.connection.db!
    const results = await db.collection('jobs').aggregate(pipeline).toArray()

    // Adaptive ranking: build skill frequency map from interaction history
    const interactionSkills = profile.recentInteractionSkills ?? []
    const skillFreq = new Map<string, number>()
    for (const s of interactionSkills) {
      skillFreq.set(s.toLowerCase(), (skillFreq.get(s.toLowerCase()) ?? 0) + 1)
    }

    const filtered = results
      .filter((j) => !appliedIds.includes(j._id.toString()))
      .map((j) => {
        const baseScore = Math.round((j._vectorScore ?? 0) * 100)
        // Boost by up to 10 points based on skill overlap with viewed jobs
        const jobSkills: string[] = (j.requiredSkills ?? []).map((s: { skill: string }) => s.skill.toLowerCase())
        const boost = Math.min(jobSkills.filter((s) => (skillFreq.get(s) ?? 0) > 0).length, 10)
        return { ...j, _id: j._id.toString(), _matchScore: Math.min(100, baseScore + boost) }
      })
      .sort((a, b) => b._matchScore - a._matchScore)

    return NextResponse.json(filtered)
  } catch (err) {
    console.warn('Atlas Vector Search failed for recommendations, using fallback:', err)

    // In-memory cosine similarity fallback
    const { cosineSimilarity } = await import('@/lib/nim')
    const db = mongoose.connection.db!
    const jobs = await db.collection('jobs')
      .find({ status: 'active', embedding: { $exists: true, $not: { $size: 0 } } })
      .toArray()

    const scored = jobs
      .filter((j) => !appliedIds.includes(j._id.toString()))
      .map((j) => ({
        ...j,
        _id: j._id.toString(),
        _matchScore: j.embedding?.length
          ? Math.round(cosineSimilarity(profile.embedding!, j.embedding) * 100)
          : 0,
      }))
      .sort((a, b) => b._matchScore - a._matchScore)
      .slice(0, 10)

    return NextResponse.json(scored)
  }
}
