import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { decomposeJD } from '@/lib/ai/decomposeJD'

export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'recruiter') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { description } = await req.json()
    if (!description?.trim()) {
      return NextResponse.json({ error: 'Description required' }, { status: 400 })
    }
    const result = await decomposeJD(description)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Decompose error:', err)
    return NextResponse.json({ error: 'AI extraction failed' }, { status: 500 })
  }
}
