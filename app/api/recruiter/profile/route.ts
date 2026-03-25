import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/db'
import CompanyProfile from '@/lib/models/CompanyProfile'

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== 'recruiter') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await connectDB()
  const profile = await CompanyProfile.findOne({ userId: session.user.id }).lean()
  return NextResponse.json(profile || {})
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'recruiter') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await connectDB()
  const body = await req.json()
  const allowed = ['companyName', 'industry', 'size', 'website', 'description'] as const
  const update: Record<string, unknown> = {}
  for (const k of allowed) {
    if (body[k] !== undefined) update[k] = body[k]
  }
  const profile = await CompanyProfile.findOneAndUpdate(
    { userId: session.user.id },
    update,
    { upsert: true, new: true }
  )
  return NextResponse.json(profile)
}
