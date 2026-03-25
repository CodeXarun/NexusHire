import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import connectDB from '@/lib/db'
import User from '@/lib/models/User'
import CandidateProfile from '@/lib/models/CandidateProfile'
import CompanyProfile from '@/lib/models/CompanyProfile'

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['candidate', 'recruiter']),
  companyName: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const data = schema.parse(body)

    await connectDB()

    const existing = await User.findOne({ email: data.email })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(data.password, 12)
    const user = await User.create({
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      provider: 'credentials',
    })

    if (data.role === 'candidate') {
      await CandidateProfile.create({ userId: user._id })
    } else {
      await CompanyProfile.create({
        userId: user._id,
        companyName: data.companyName || '',
      })
    }

    return NextResponse.json({ message: 'Account created successfully' }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('Register error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
