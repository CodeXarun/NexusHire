import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/db'
import mongoose from 'mongoose'
import { generateEmbedding } from '@/lib/nim'

export async function GET(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'recruiter') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const limit = 20

  await connectDB()

  if (!q.trim()) {
    // Return recently updated candidate profiles
    const db = mongoose.connection.db!
    const profiles = await db.collection('candidateprofiles')
      .find({ embedding: { $exists: true, $not: { $size: 0 } } })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray()
    return NextResponse.json(profiles.map((p) => ({ ...p, _id: p._id.toString() })))
  }

  // Generate embedding for the natural language query
  let embedding: number[] = []
  try {
    embedding = await generateEmbedding(q)
  } catch {
    console.warn('Candidate search embedding failed — falling back to text search')
  }

  if (embedding.length) {
    try {
      const pipeline: mongoose.PipelineStage[] = [
        {
          $vectorSearch: {
            index: 'candidates_vector_index',
            path: 'embedding',
            queryVector: embedding,
            numCandidates: 100,
            limit,
          },
        } as mongoose.PipelineStage,
        {
          $addFields: { _searchScore: { $meta: 'vectorSearchScore' } },
        },
        { $sort: { _searchScore: -1 } },
      ]

      const db = mongoose.connection.db!
      const results = await db.collection('candidateprofiles').aggregate(pipeline).toArray()

      // Enrich with user info
      const userIds = results.map((p) => p.userId)
      const users = await mongoose.connection.db!.collection('users')
        .find({ _id: { $in: userIds } })
        .project({ name: 1, email: 1, image: 1 })
        .toArray()
      const userMap = new Map(users.map((u) => [u._id.toString(), u]))

      return NextResponse.json(
        results.map((p) => {
          const user = userMap.get(p.userId?.toString() || '')
          return {
            ...p,
            _id: p._id.toString(),
            userId: p.userId?.toString(),
            _matchScore: Math.round((p._searchScore ?? 0) * 100),
            name: user?.name,
            email: user?.email,
            image: user?.image,
          }
        })
      )
    } catch (err) {
      console.warn('Atlas Vector Search failed for candidates, using text fallback:', err)
    }
  }

  // Text fallback
  const db = mongoose.connection.db!
  const profiles = await db.collection('candidateprofiles')
    .find({
      $or: [
        { headline: { $regex: q, $options: 'i' } },
        { 'skills.skill': { $regex: q, $options: 'i' } },
        { location: { $regex: q, $options: 'i' } },
      ],
    })
    .limit(limit)
    .toArray()

  const userIds = profiles.map((p) => p.userId)
  const users = await mongoose.connection.db!.collection('users')
    .find({ _id: { $in: userIds } })
    .project({ name: 1, email: 1, image: 1 })
    .toArray()
  const userMap = new Map(users.map((u) => [u._id.toString(), u]))

  return NextResponse.json(
    profiles.map((p) => {
      const user = userMap.get(p.userId?.toString() || '')
      return {
        ...p,
        _id: p._id.toString(),
        userId: p.userId?.toString(),
        name: user?.name,
        email: user?.email,
        image: user?.image,
      }
    })
  )
}
