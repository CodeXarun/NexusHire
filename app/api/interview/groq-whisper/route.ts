import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const audio = formData.get('file') as Blob | null
  if (!audio) return NextResponse.json({ error: 'No audio file' }, { status: 400 })

  const upstreamForm = new FormData()
  upstreamForm.append('file', audio, 'recording.webm')
  upstreamForm.append('model', 'whisper-large-v3-turbo')
  upstreamForm.append('language', 'en')

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: upstreamForm,
  })

  if (!res.ok) return NextResponse.json({ error: 'Whisper failed' }, { status: 500 })
  const data = await res.json()
  return NextResponse.json({ text: data.text || '' })
}
