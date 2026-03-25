import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import { UserModel } from '@/lib/models/User'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')
  if (!email) return NextResponse.json({ exists: false })

  await connectDB()
  const user = await UserModel.findOne({ email }).select('_id').lean()
  return NextResponse.json({ exists: !!user })
}
