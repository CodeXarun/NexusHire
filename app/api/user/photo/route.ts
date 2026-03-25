import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/db'
import { UserModel } from '@/lib/models/User'
import crypto from 'crypto'
import { uploadImage } from '@/lib/s3'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const photo = formData.get('photo')

  if (!photo || !(photo instanceof File)) {
    return NextResponse.json({ error: 'Missing photo file' }, { status: 400 })
  }

  if (!photo.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  }

  // Keep it conservative to avoid huge DB entries
  const MAX_BYTES = 2 * 1024 * 1024 // 2MB
  if (photo.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image too large (max 2MB)' }, { status: 400 })
  }

  const buffer = Buffer.from(await photo.arrayBuffer())
  const ext = photo.type.split('/')[1] || 'png'
  const random = crypto.randomBytes(8).toString('hex')
  const key = `profile-photos/${session.user.id}/${Date.now()}-${random}.${ext}`

  await connectDB()
  await uploadImage(buffer, key, photo.type)
  // Store S3 object key in DB (session callback will convert to a signed URL).
  await UserModel.findByIdAndUpdate(session.user.id, { image: key }, { new: true })

  // Do not generate a signed URL here (avoids presign expiry issues).
  // The session callback will sign the URL when building `session.user.image`.
  return NextResponse.json({ ok: true, imageKey: key })
}

