'use client'

import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Navbar } from '@/components/Navbar'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Job {
  _id: string
  title: string
  companyName: string
  roleLevel?: string
  requiredSkills?: Array<{ skill: string; weight?: number }>
  description?: string
}

interface TranscriptEntry { question: string; answer: string }

interface FeedbackData {
  overallScore: number
  categoryScores: Record<string, number>
  perQuestionFeedback: Array<{
    questionIndex: number; question: string; score: number
    quality: string; feedback: string; idealAnswer: string
  }>
  strengths: string[]
  improvements: string[]
  overallAssessment: string
  learningResources: Array<{ skill: string; resources: Array<{ title: string; url: string; type: string }> }>
  trendingTechnologies: Array<{ name: string; reason: string; resource: { title: string; url: string; type: string } }>
  violations?: { tab: number; fs: number; face: number }
  autoSubmitted?: boolean
}

// ─── STAGE ────────────────────────────────────────────────────────────────────
const STAGE = {
  SETUP: 'setup', SPEAKING: 'speaking', LISTENING: 'listening',
  BETWEEN: 'between', PROCESSING: 'processing', REPORT: 'report',
} as const
type Stage = typeof STAGE[keyof typeof STAGE]

const SCORE_CATS = [
  { key: 'communicationSkills', label: 'Communication', icon: '💬' },
  { key: 'technicalKnowledge',  label: 'Technical',     icon: '⚙️' },
  { key: 'problemSolving',      label: 'Problem Solving', icon: '🧩' },
  { key: 'culturalRoleFit',     label: 'Culture Fit',   icon: '🤝' },
  { key: 'confidenceClarity',   label: 'Confidence',    icon: '🎯' },
]

// ─── GROQ PROXIES ─────────────────────────────────────────────────────────────
async function callGroq(prompt: string): Promise<string> {
  const res = await fetch('/api/interview/groq-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.text || ''
}

async function callGroqWhisper(audioBlob: Blob): Promise<string> {
  const form = new FormData()
  form.append('file', audioBlob, 'recording.webm')
  const res = await fetch('/api/interview/groq-whisper', { method: 'POST', body: form })
  if (!res.ok) throw new Error('Whisper failed')
  const data = await res.json()
  return data.text || ''
}

// ─── PROMPTS ──────────────────────────────────────────────────────────────────
function parseSkills(jd: string, fallback: Array<{ skill: string } | string> = []) {
  if (jd?.trim()) {
    const lines = jd.split('\n')
    const skillLines: string[] = []
    let inSection = false
    for (const line of lines) {
      if (/skills|technologies|tech stack|requirements|qualifications|tools|languages|frameworks/i.test(line)) inSection = true
      if (inSection && line.trim()) skillLines.push(line)
      if (inSection && skillLines.length > 10) break
    }
    const source = skillLines.length > 1 ? skillLines.join(', ') : jd
    const tokens = source.replace(/[•\-–—*]/g, ',').split(/[,;\n]+/)
      .map(t => t.replace(/[^a-zA-Z0-9.#+\s]/g, '').trim()).filter(t => t.length >= 2 && t.length <= 40)
    const unique = Array.from(new Set(tokens))
    if (unique.length >= 1) return unique
  }
  return fallback.map(s => (typeof s === 'string' ? s : s.skill))
}

function promptQuestions({ job, resumeText, jd }: { job: Job; resumeText: string; jd: string }) {
  const skills = parseSkills(jd, job.requiredSkills || [])
  const seed = Math.floor(Math.random() * 99999)
  return `You are an expert technical interviewer. Seed: ${seed}.
Job: ${job.title} at ${job.companyName} (${job.roleLevel || 'mid-level'})
REQUIRED SKILLS:
${skills.map((s, i) => `${i + 1}. ${s}`).join('\n')}
CRITICAL: Ask ONLY about skills listed above.
${jd ? `\nJob Description:\n${jd.trim()}\n` : ''}
${resumeText ? `\nCandidate Resume:\n${resumeText.trim()}\n` : ''}
Generate exactly 5 unique interview questions. Mix: 3 deep technical, 1 scenario, 1 experience-mapping.
Rules: voice-friendly, no markdown, 1-2 sentences max, do NOT number them.
Return ONLY a JSON array of strings. Example: ["Question one", "Question two"]`
}

function promptFeedback({ job, transcript, jd }: { job: Job; transcript: TranscriptEntry[]; jd: string }) {
  const skills = parseSkills(jd, job.requiredSkills || [])
  const tagged = transcript.map((t, i) => {
    const empty = !t.answer?.trim() || t.answer.trim() === '(skipped)'
    const wordCount = empty ? 0 : t.answer.trim().split(/\s+/).length
    const short = !empty && wordCount < 8
    return { i: i + 1, q: t.question, a: t.answer || '(no answer)', empty, short, wordCount }
  })
  const formatted = tagged.map(t =>
    `Q${t.i}: ${t.q}\nA${t.i}: ${t.empty ? '⚠️ NO ANSWER — must score 0' : `"${t.a}" [${t.wordCount} words]`}${t.short ? ' ← very short, likely vague' : ''}`
  ).join('\n\n')
  const empties = tagged.filter(t => t.empty).length
  return `You are a STRICT, realistic technical interviewer evaluating a candidate for: ${job.title} at ${job.companyName}.

IMPORTANT: Base every score ONLY on what the candidate ACTUALLY SAID. Do not give benefit of the doubt.

SCORING RUBRIC:
- No answer / skipped = 0
- Filler words, under 8 words, no substance = 0–15
- Vague answer without specifics = 15–30
- Partially correct, missing key concepts = 30–55
- Correct with reasonable detail = 55–75
- Strong, specific, demonstrates real experience = 75–90
- Exceptional, covers edge cases, examples = 90–100

${empties >= 3 ? 'RULE: overallScore MUST be ≤ 20 (3+ unanswered).' : empties >= 2 ? 'RULE: overallScore MUST be ≤ 35 (2+ unanswered).' : ''}

TRANSCRIPT:
${formatted}

For learningResources: only for skills with score < 55. Skills domain: ${skills.join(', ')}. Provide 2 REAL URLs.

Return ONLY valid JSON (no markdown, no fences):
{"overallScore":0-100,"categoryScores":{"communicationSkills":0-100,"technicalKnowledge":0-100,"problemSolving":0-100,"culturalRoleFit":0-100,"confidenceClarity":0-100},"perQuestionFeedback":[{"questionIndex":0,"question":"...","score":0-100,"quality":"correct|partial|incorrect|not_answered","feedback":"2-3 sentences","idealAnswer":"2-3 sentences"}],"strengths":["..."],"improvements":["..."],"overallAssessment":"2-3 sentences","learningResources":[{"skill":"...","resources":[{"title":"...","url":"real URL","type":"video|article|course|docs"}]}],"trendingTechnologies":[{"name":"...","reason":"...","resource":{"title":"...","url":"real URL","type":"video|article|course|docs"}}]}`
}

// ─── LOAD PUTER.JS (once, lazily) ─────────────────────────────────────────────
function loadPuter(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') { resolve(); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).puter) { resolve(); return }
    if (document.querySelector('script[data-puter]')) {
      // Already injected but not loaded yet — poll
      const iv = setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).puter) { clearInterval(iv); resolve() }
      }, 100)
      return
    }
    const s = document.createElement('script')
    s.src = 'https://js.puter.com/v2/'
    s.dataset.puter = '1'
    s.onload = () => resolve()
    s.onerror = () => resolve()   // non-fatal — browser TTS fallback kicks in
    document.head.appendChild(s)
  })
}

// ─── SPEECH HOOK ──────────────────────────────────────────────────────────────
function useSpeech() {
  const audioRef      = useRef<HTMLAudioElement | null>(null)
  const speakIdRef    = useRef(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef        = useRef<any>(null)
  const listenRef     = useRef(false)
  const mrRef         = useRef<MediaRecorder | null>(null)
  const chunksRef     = useRef<Blob[]>([])
  const micStreamRef  = useRef<MediaStream | null>(null)

  const [sttMode, setSttMode] = useState<'webspeech' | 'whisper'>('webspeech')

  // Load Puter.js once on mount
  useEffect(() => { loadPuter() }, [])

  const unlockAudio = useCallback(() => {
    // Puter.js handles its own audio — just ensure a silent AudioContext is running
    // so browsers don't block the first Audio() play on iOS/Safari
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const buf = ctx.createBuffer(1, 1, 22050)
      const src = ctx.createBufferSource()
      src.buffer = buf; src.connect(ctx.destination); src.start(0)
    } catch (_) {}
  }, [])

  // ── Browser TTS fallback (used when Puter.js is unavailable) ────────────
  const browserSpeak = useCallback((text: string, onDone?: () => void) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) { onDone?.(); return }
    try { window.speechSynthesis.cancel() } catch (_) {}

    let finished = false
    const finish = () => { if (finished) return; finished = true; setTimeout(() => onDone?.(), 300) }

    const wordCount = text.trim().split(/\s+/).length
    const failsafe = setTimeout(finish, Math.max(5000, wordCount * 450 + 1500))

    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 0.95; utt.pitch = 1
    utt.onend  = () => { clearTimeout(failsafe); finish() }
    utt.onerror = () => { clearTimeout(failsafe); finish() }
    setTimeout(() => {
      try { window.speechSynthesis.speak(utt) }
      catch (_) { clearTimeout(failsafe); finish() }
    }, 80)
  }, [])

  // ── Primary TTS: Puter.js (free, unlimited, no key) ─────────────────────
  const speak = useCallback(async (text: string, onDone?: () => void) => {
    const myId = ++speakIdRef.current
    const mine = () => speakIdRef.current === myId
    if (audioRef.current) { try { audioRef.current.pause() } catch (_) {} audioRef.current = null }

    try {
      await loadPuter()   // no-op if already loaded
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const puter = (window as any).puter
      if (!puter?.ai?.txt2speech) throw new Error('puter.ai.txt2speech not available')

      const audio: HTMLAudioElement = await puter.ai.txt2speech(text)
      if (!mine()) return

      audioRef.current = audio
      let done = false
      const finish = () => {
        if (!mine() || done) return
        done = true; audioRef.current = null; setTimeout(() => onDone?.(), 300)
      }
      // Failsafe in case onended never fires
      const wordCount = text.trim().split(/\s+/).length
      const failsafe = setTimeout(finish, Math.max(6000, wordCount * 500 + 2000))
      audio.onended = () => { clearTimeout(failsafe); finish() }
      audio.onerror = () => { clearTimeout(failsafe); finish() }
      await audio.play()
    } catch (e) {
      console.warn('[Puter TTS failed, using browser TTS]', (e as Error).message)
      if (mine()) browserSpeak(text, onDone)
    }
  }, [browserSpeak])

  const stopSpeaking = useCallback(() => {
    speakIdRef.current++
    if (audioRef.current) { try { audioRef.current.pause() } catch (_) {} audioRef.current = null }
    try { window.speechSynthesis?.cancel() } catch (_) {}
  }, [])

  const stopListening = useCallback(() => {
    listenRef.current = false
    try { recRef.current?.abort() } catch (_) {}
    try { mrRef.current?.stop() } catch (_) {}
    recRef.current = null; mrRef.current = null
  }, [])

  const startWebSpeech = useCallback((
    onResult: (text: string) => void,
    onError: (e: { error: string }) => void,
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) { onError({ error: 'not-supported' }); return false }
    let acc = ''; let gen = 0
    listenRef.current = true

    function boot(myGen: number, attempt: number) {
      if (!listenRef.current || myGen !== gen) return
      const rec = new SR()
      rec.continuous = true
      rec.interimResults = true
      rec.lang = 'en-IN'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (e: any) => {
        const latest = e.results[e.results.length - 1]
        const t = latest[0].transcript
        if (latest.isFinal) {
          acc += (acc ? ' ' : '') + t
          onResult(acc)
        } else {
          onResult(acc + (acc ? ' ' : '') + t)
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onerror = (e: any) => {
        console.warn('[WebSpeech error]', e.error)
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') onError({ error: e.error })
        // network/no-speech errors are transient — let onend restart
      }
      rec.onend = () => {
        if (!listenRef.current || myGen !== gen) return
        gen++; setTimeout(() => boot(gen, 0), 150)
      }
      recRef.current = rec
      try { rec.start(); console.log('[WebSpeech] started, lang=en-IN') }
      catch (e) {
        console.warn('[WebSpeech start failed]', e)
        if (attempt < 3) setTimeout(() => boot(myGen, attempt + 1), 500)
        else onError({ error: 'start-failed' })
      }
    }
    boot(gen, 0)
    return true
  }, [])

  const startWhisper = useCallback((
    onResult: (text: string) => void,
    onError: (e: { error: string }) => void,
    stream: MediaStream | null,
  ) => {
    if (!stream) { onError({ error: 'no-stream' }); return }
    chunksRef.current = []
    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    mrRef.current = mr
    listenRef.current = true
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onerror = () => onError({ error: 'recorder-error' })
    mr.start(250)
  }, [])

  const finishWhisper = useCallback(async (onResult: (text: string) => void) => {
    if (!mrRef.current) return
    try { mrRef.current.stop() } catch (_) {}
    await new Promise(r => setTimeout(r, 350))
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    if (blob.size < 1000) { onResult(''); return }
    try { const text = await callGroqWhisper(blob); onResult(text) }
    catch (e) { console.warn('[Whisper]', e); onResult('') }
  }, [])

  // Acquire mic on-demand for Whisper (called only when Web Speech API fails)
  const getMicStream = useCallback(async (): Promise<MediaStream | null> => {
    if (micStreamRef.current?.active) return micStreamRef.current
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      micStreamRef.current = s
      return s
    } catch (e) { console.warn('[Mic getUserMedia]', e); return null }
  }, [])

  const listen = useCallback((
    onResult: (text: string) => void,
    onError: (e: { error: string }) => void,
  ) => {
    const fallbackToWhisper = async () => {
      console.warn('[STT] WebSpeech blocked — switching to Whisper mode')
      setSttMode('whisper')
      const stream = await getMicStream()
      if (stream) startWhisper(onResult, onError, stream)
      else onError({ error: 'mic-denied' })
    }

    const ok = startWebSpeech(onResult, (err) => {
      if (err.error === 'not-allowed' || err.error === 'service-not-allowed' || err.error === 'start-failed') {
        fallbackToWhisper()
      }
    })
    if (!ok) fallbackToWhisper()
  }, [startWebSpeech, startWhisper, getMicStream])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = typeof window !== 'undefined' ? (window as any) : null
  const supported = !!(w?.SpeechRecognition || w?.webkitSpeechRecognition || w?.MediaRecorder)

  return { supported, sttMode, speak, stopSpeaking, listen, stopListening, finishWhisper, unlockAudio, micStreamRef }
}

// ─── YOLO PERSON DETECTION ────────────────────────────────────────────────────
const TFJS_CDN = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js'
const COCO_CDN = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js'

async function loadYOLO() {
  const load = (src: string) => new Promise<void>((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res()
    const s = document.createElement('script')
    s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('Script failed: ' + src))
    document.head.appendChild(s)
  })
  await load(TFJS_CDN); await load(COCO_CDN)
}

function usePersonDetection({ videoRef, active, onViolation }: {
  videoRef: React.RefObject<HTMLVideoElement | null>
  active: boolean
  onViolation: (msg: string) => void
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelRef  = useRef<any>(null)
  const readyRef  = useRef(false)
  const loadedRef = useRef(false)
  const coolRef   = useRef(false)
  const badRef    = useRef(0)
  const intRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    ;(async () => {
      try {
        await loadYOLO()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(window as any).cocoSsd) throw new Error('cocoSsd not found')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        modelRef.current = await (window as any).cocoSsd.load({ base: 'mobilenet_v2' })
        readyRef.current = true
      } catch (e) { console.warn('[YOLO] disabled:', (e as Error).message) }
    })()
  }, [])

  useEffect(() => {
    if (!active) { if (intRef.current) clearInterval(intRef.current); badRef.current = 0; return }
    intRef.current = setInterval(async () => {
      if (!readyRef.current) return
      const v = videoRef.current
      if (!v || v.readyState < 2 || v.videoWidth === 0) return
      try {
        const preds = await modelRef.current.detect(v)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const n = preds.filter((p: any) => p.class === 'person' && p.score > 0.45).length
        if (n === 1) { badRef.current = 0; return }
        if (++badRef.current < 4) return
        if (coolRef.current) return
        coolRef.current = true; badRef.current = 0
        onViolation(n === 0 ? 'Stay visible in the camera frame' : 'Multiple people detected')
        setTimeout(() => { coolRef.current = false }, 20000)
      } catch (_) {}
    }, 2000)
    return () => { if (intRef.current) clearInterval(intRef.current) }
  }, [active, videoRef, onViolation])
}

// ─── SMALL UI COMPONENTS ──────────────────────────────────────────────────────
function Bars({ active, color = '#818cf8' }: { active: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 28 }}>
      {[4, 7, 12, 18, 22, 18, 12, 7, 4, 7, 12].map((h, i) => (
        <div key={i} style={{
          width: 3.5, borderRadius: 4, background: color, opacity: active ? 1 : 0.3,
          height: active ? h : 3,
          transition: 'height .12s, opacity .3s',
          animation: active ? `barAnim ${0.28 + i * 0.06}s ease-in-out infinite alternate` : 'none',
          transformOrigin: 'bottom',
        }} />
      ))}
      <style>{`@keyframes barAnim{from{transform:scaleY(.3)}to{transform:scaleY(1.2)}}`}</style>
    </div>
  )
}

function MicOrb({ active }: { active: boolean }) {
  return (
    <div style={{ position: 'relative', width: 110, height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {active && (
        <>
          <div style={{ position: 'absolute', width: 160, height: 160, borderRadius: '50%', background: 'rgba(52,211,153,.06)', animation: 'orbPulse 2.2s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', width: 135, height: 135, borderRadius: '50%', background: 'rgba(52,211,153,.1)', animation: 'orbPulse 2.2s ease-in-out infinite .55s' }} />
        </>
      )}
      <div style={{
        width: 110, height: 110, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40,
        background: active ? 'radial-gradient(circle,rgba(52,211,153,.22) 0%,rgba(52,211,153,.06) 100%)' : 'rgba(255,255,255,.04)',
        border: `2px solid ${active ? 'rgba(52,211,153,.5)' : 'rgba(255,255,255,.08)'}`,
        boxShadow: active ? '0 0 40px rgba(52,211,153,.25)' : 'none',
        transition: 'all .4s ease',
        position: 'relative', zIndex: 1,
      }}>
        🎙️
      </div>
      <style>{`@keyframes orbPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.12);opacity:.6}}`}</style>
    </div>
  )
}

function ScoreRing({ pct, size = 112, stroke = 9, color }: { pct: number; size?: number; stroke?: number; color: string }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1.2s ease' }} />
    </svg>
  )
}

function ScoreLine({ label, icon, score }: { label: string; icon: string; score: number }) {
  const c = score >= 75 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171'
  const bg = score >= 75 ? 'rgba(52,211,153,.08)' : score >= 50 ? 'rgba(251,191,36,.08)' : 'rgba(248,113,113,.08)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 13, padding: '10px 14px', borderRadius: 12, background: bg, border: `1px solid ${c}22` }}>
      <span style={{ fontSize: 17, width: 24, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#cbd5e1' }}>{label}</span>
      <div style={{ width: 120, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.07)', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ width: `${score}%`, height: '100%', background: `linear-gradient(90deg,${c}99,${c})`, borderRadius: 3, transition: 'width 1.3s cubic-bezier(.4,0,.2,1)' }} />
      </div>
      <span style={{ fontSize: 14, fontWeight: 800, color: c, minWidth: 32, textAlign: 'right' }}>{score}</span>
    </div>
  )
}

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const G = {
  page:       { minHeight: '100vh', background: 'linear-gradient(160deg,#05050e 0%,#09091a 60%,#06060f 100%)', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' },
  card:       { background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 20, padding: '1.5rem', marginBottom: '1rem', backdropFilter: 'blur(20px)' as const },
  input:      { width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical' as const, lineHeight: 1.6, boxSizing: 'border-box' as const },
  label:      { fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 8, display: 'block' },
  btnPrimary: { width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-.01em', boxShadow: '0 0 32px rgba(99,102,241,.3)' },
  btnGhost:   { padding: '10px 20px', borderRadius: 12, border: '1px solid rgba(255,255,255,.09)', background: 'rgba(255,255,255,.04)', color: '#94a3b8', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
}

// ─── VOICE INTERVIEW COMPONENT ────────────────────────────────────────────────
function VoiceInterview({ job, initialResumeText }: { job: Job; initialResumeText: string }) {
  const { supported, sttMode, speak, stopSpeaking, listen, stopListening, finishWhisper, unlockAudio, micStreamRef } = useSpeech()

  const [stage, setStage]           = useState<Stage>(STAGE.SETUP)
  const [questions, setQuestions]   = useState<string[]>([])
  const questionsRef                = useRef<string[]>([])   // always-fresh — avoids stale closure
  const [qIdx, setQIdx]             = useState(0)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const transcriptRef               = useRef<TranscriptEntry[]>([])
  const [liveText, setLiveText]     = useState('')
  const [feedback, setFeedback]     = useState<FeedbackData | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [loading, setLoading]       = useState(false)
  const [muted, setMuted]           = useState(false)
  const [elapsed, setElapsed]       = useState(0)

  const [resumeText, setResumeText] = useState(initialResumeText)
  const [jd, setJd]                 = useState(job.description || '')
  const jdRef     = useRef(job.description || '')
  const resumeRef = useRef(initialResumeText)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [camStatus, setCamStatus]   = useState<'pending' | 'granted' | 'denied'>('pending')
  const [camStream, setCamStream]   = useState<MediaStream | null>(null)
  const [violations, setViolations] = useState({ tab: 0, fs: 0, face: 0 })
  const [warning, setWarning]       = useState<string | null>(null)
  const violRef    = useRef({ tab: 0, fs: 0, face: 0 })
  const activeRef  = useRef(false)
  const autoSubRef = useRef(false)
  const accRef     = useRef('')
  const faceVidRef = useRef<HTMLVideoElement | null>(null)
  const bgVidRef   = useRef<HTMLVideoElement | null>(null)
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const finishRef  = useRef<(() => void) | null>(null)

  const setJdSynced      = (v: string) => { setJd(v);        jdRef.current = v }
  const setResumeSynced  = (v: string) => { setResumeText(v); resumeRef.current = v }

  // keep transcriptRef fresh
  useEffect(() => { transcriptRef.current = transcript }, [transcript])

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const on = [STAGE.SPEAKING, STAGE.LISTENING, STAGE.BETWEEN].includes(stage as never)
    if (on) timerRef.current = setInterval(() => setElapsed(t => t + 1), 1000)
    else if (timerRef.current) clearInterval(timerRef.current)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [stage])
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // ── Security ──────────────────────────────────────────────────────────────
  useEffect(() => { activeRef.current = [STAGE.SPEAKING, STAGE.LISTENING, STAGE.BETWEEN].includes(stage as never) }, [stage])

  const addViolation = useCallback((type: 'tab' | 'fs' | 'face') => {
    if (!activeRef.current || autoSubRef.current) return
    const v = { ...violRef.current, [type]: violRef.current[type] + 1 }
    violRef.current = v; setViolations({ ...v })
    const total = v.tab + v.fs + v.face
    if (total >= 3) {
      autoSubRef.current = true
      setWarning('🚫 Max violations reached — auto-submitting')
      stopListening(); stopSpeaking()
      setTimeout(() => finishRef.current?.(), 1500)
    } else {
      const left = 3 - total
      const msgs = { tab: '⚠️ Tab switching detected', fs: '⚠️ Fullscreen exited', face: '⚠️ Camera issue' }
      setWarning(`${msgs[type]} — ${left} warning${left !== 1 ? 's' : ''} left`)
      setTimeout(() => setWarning(null), 4000)
    }
  }, [stopListening, stopSpeaking])

  useEffect(() => {
    const onVis = () => { if (document.hidden) addViolation('tab') }
    const onFs  = () => { if (!document.fullscreenElement) addViolation('fs') }
    document.addEventListener('visibilitychange', onVis)
    document.addEventListener('fullscreenchange', onFs)
    return () => { document.removeEventListener('visibilitychange', onVis); document.removeEventListener('fullscreenchange', onFs) }
  }, [addViolation])

  // ── YOLO ──────────────────────────────────────────────────────────────────
  const yoloActive  = [STAGE.SPEAKING, STAGE.LISTENING, STAGE.BETWEEN].includes(stage as never)
  const onFaceViol  = useCallback(() => addViolation('face'), [addViolation])
  usePersonDetection({ videoRef: faceVidRef, active: yoloActive, onViolation: onFaceViol })

  const faceVidCb = useCallback((node: HTMLVideoElement | null) => {
    faceVidRef.current = node
    if (node && camStream && node.srcObject !== camStream) node.srcObject = camStream
  }, [camStream])
  const bgVidCb = useCallback((node: HTMLVideoElement | null) => {
    bgVidRef.current = node
    if (node && camStream && node.srcObject !== camStream) node.srcObject = camStream
  }, [camStream])

  // ── Camera ────────────────────────────────────────────────────────────────
  const requestCam = useCallback(async () => {
    try {
      // Camera only — do NOT pre-acquire the mic here.
      // Web Speech API needs exclusive mic access; holding a getUserMedia audio stream
      // blocks it in Chrome. Mic is acquired on-demand only if Whisper fallback is needed.
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      setCamStream(stream)
      setCamStatus('granted')
      return true
    } catch (e) {
      setCamStatus('denied')
      setError('Camera access required. Please allow camera access, then retry.')
      return false
    }
  }, [])

  useEffect(() => {
    if (stage === STAGE.SETUP && camStream) {
      camStream.getTracks().forEach(t => t.stop())
      setCamStream(null); setCamStatus('pending')
      micStreamRef.current?.getTracks().forEach(t => t.stop())
      micStreamRef.current = null
    }
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { camStream?.getTracks().forEach(t => t.stop()) }, [camStream])

  // ── THE CORE: start mic when stage = LISTENING ─────────────────────────────
  useEffect(() => {
    if (stage !== STAGE.LISTENING) return
    setLiveText(''); accRef.current = ''
    let silenceTimer: ReturnType<typeof setTimeout> | null = null

    const resetSilenceTimer = (hasText: boolean) => {
      if (silenceTimer) clearTimeout(silenceTimer)
      if (!hasText) return
      silenceTimer = setTimeout(() => {
        if (accRef.current.trim().split(/\s+/).length >= 3) setStage(STAGE.BETWEEN)
      }, 12000)
    }

    const t = setTimeout(() => {
      listen(
        (text) => { accRef.current = text; setLiveText(text); resetSilenceTimer(!!text.trim()) },
        (err)  => {
          console.warn('[STT]', err.error)
          if (err.error === 'not-allowed' || err.error === 'service-not-allowed') {
            setError('Microphone permission denied. Please allow mic access in your browser and retry.')
          }
        },
      )
    }, 300)
    return () => { clearTimeout(t); if (silenceTimer) clearTimeout(silenceTimer); stopListening() }
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Speak question ────────────────────────────────────────────────────────
  // Uses questionsRef (not questions state) to avoid stale closures in startInterview's setTimeout
  const speakQ = useCallback((idx: number) => {
    const text = questionsRef.current[idx]
    if (!text) { setStage(STAGE.LISTENING); return }  // safety guard
    if (muted) { setStage(STAGE.LISTENING); return }
    setStage(STAGE.SPEAKING)
    speak(text, () => {
      try { window.speechSynthesis?.cancel() } catch (_) {}
      setStage(STAGE.LISTENING)
    })
  }, [muted, speak])

  // ── Start interview ───────────────────────────────────────────────────────
  const startInterview = async () => {
    unlockAudio()
    setLoading(true); setError(null)
    if (camStatus !== 'granted') { const ok = await requestCam(); if (!ok) { setLoading(false); return } }
    try {
      const raw = await callGroq(promptQuestions({ job, resumeText: resumeRef.current, jd: jdRef.current }))
      const cleaned = raw.replace(/```json|```/g, '').trim()
      const match = cleaned.match(/\[[\s\S]*\]/)
      const qs: string[] = JSON.parse(match ? match[0] : cleaned)
      questionsRef.current = qs           // update ref BEFORE the setTimeout so speakQ sees them
      setQuestions(qs); setQIdx(0); setTranscript([]); setElapsed(0)
      violRef.current = { tab: 0, fs: 0, face: 0 }
      setViolations({ tab: 0, fs: 0, face: 0 })
      autoSubRef.current = false; setWarning(null)
      try { await document.documentElement.requestFullscreen() } catch (_) {}
      setTimeout(() => speakQ(0), 400)
    } catch (e) {
      setError('Failed to generate questions. Check connection and try again.')
      console.error(e)
    } finally { setLoading(false) }
  }

  // ── Answer actions ────────────────────────────────────────────────────────
  const submitAnswer = useCallback(async () => {
    stopListening()
    let answer = accRef.current || liveText || ''
    if (sttMode === 'whisper' && !answer) {
      setLiveText('Transcribing…')
      await finishWhisper(text => { accRef.current = text; setLiveText(text) })
      answer = accRef.current
    }
    setTranscript(prev => [...prev, { question: questionsRef.current[qIdx] ?? '', answer }])
    setLiveText(''); setStage(STAGE.BETWEEN)
  }, [qIdx, liveText, sttMode, stopListening, finishWhisper])

  const skipQuestion = useCallback(() => {
    stopListening()
    setTranscript(prev => [...prev, { question: questionsRef.current[qIdx] ?? '', answer: '(skipped)' }])
    setLiveText(''); setStage(STAGE.BETWEEN)
  }, [qIdx, stopListening])

  const reAnswer = useCallback(() => {
    setTranscript(prev => prev.slice(0, -1))
    setStage(STAGE.LISTENING)
  }, [])

  const nextQuestion = useCallback(() => {
    const next = qIdx + 1
    if (next < questionsRef.current.length) { setQIdx(next); speakQ(next) }
    else finishRef.current?.()
  }, [qIdx, speakQ])

  // ── Finish interview ──────────────────────────────────────────────────────
  const finishInterview = useCallback(async () => {
    if (document.fullscreenElement) { try { await document.exitFullscreen() } catch (_) {} }
    camStream?.getTracks().forEach(t => t.stop())
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    micStreamRef.current = null
    stopListening(); stopSpeaking()
    setStage(STAGE.PROCESSING); setLoading(true)
    const currentJd = jdRef.current
    const finalTranscript = transcriptRef.current
    try {
      const raw = await callGroq(promptFeedback({ job, transcript: finalTranscript, jd: currentJd }))
      const clean = raw.replace(/```json|```/g, '').trim()
      const match = clean.match(/\{[\s\S]*\}/)
      const fb = JSON.parse(match ? match[0] : clean) as FeedbackData
      fb.violations = { ...violRef.current }
      fb.autoSubmitted = autoSubRef.current
      setFeedback(fb); setStage(STAGE.REPORT)
    } catch (e) {
      setError('Failed to generate feedback.')
      setStage(STAGE.BETWEEN)
      console.error(e)
    } finally { setLoading(false) }
  }, [camStream, stopListening, stopSpeaking, job])

  useEffect(() => { finishRef.current = finishInterview }, [finishInterview])

  const reset = () => {
    setStage(STAGE.SETUP); setQuestions([]); setQIdx(0); setTranscript([])
    setFeedback(null); setElapsed(0); setLiveText(''); setError(null); setWarning(null)
  }

  // ── RENDER: SETUP ─────────────────────────────────────────────────────────
  if (stage === STAGE.SETUP) {
    const skills = parseSkills(jd, job.requiredSkills || [])

    return (
      <div style={G.page}>
        <Navbar />
        <div style={{ maxWidth: 580, margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>
          <Link href="/candidate/applications" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569', textDecoration: 'none', marginBottom: '2rem', transition: 'color .2s' }}>
            <ArrowLeft style={{ width: 13, height: 13 }} /> Back to applications
          </Link>

          {/* ── Hero header ── */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ width: 72, height: 72, borderRadius: 22, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 1.25rem', boxShadow: '0 0 40px rgba(99,102,241,.4)' }}>🎤</div>
            <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, letterSpacing: '-.03em', background: 'linear-gradient(135deg,#e2e8f0,#94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              AI Mock Interview
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: '#475569' }}>
              <span style={{ color: '#818cf8', fontWeight: 600 }}>{job.title}</span>
              <span style={{ margin: '0 8px', color: '#334155' }}>·</span>
              {job.companyName}
            </p>
          </div>

          {/* ── Skills being tested ── */}
          <div style={{ ...G.card }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#cbd5e1' }}>Skills being tested</span>
              <span style={{ fontSize: 11, background: 'rgba(52,211,153,.08)', border: '1px solid rgba(52,211,153,.2)', color: '#34d399', borderRadius: 20, padding: '3px 11px', fontWeight: 600 }}>Auto-loaded</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {skills.slice(0, 20).map(s => (
                <span key={s} style={{ fontSize: 12, padding: '5px 13px', borderRadius: 20, background: 'rgba(99,102,241,.1)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,.22)', fontWeight: 500 }}>{s}</span>
              ))}
            </div>
            {resumeText && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569' }}>
                <span style={{ color: '#34d399', fontSize: 14 }}>✓</span>
                Resume &amp; profile loaded
              </div>
            )}
          </div>

          {/* ── How it works ── */}
          <div style={{ ...G.card }}>
            <p style={{ ...G.label, marginBottom: 14 }}>How it works</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {([
                ['🔊', 'AI speaks each question aloud'],
                ['🎙️', 'You answer verbally in real-time'],
                ['⏩', 'Click Done or wait for auto-detect'],
                ['📊', 'Get a full scored debrief report'],
              ] as [string, string][]).map(([ic, txt]) => (
                <div key={txt} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)' }}>
                  <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>{ic}</span>
                  <span style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{txt}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Advanced options ── */}
          <div style={{ marginBottom: '1.25rem' }}>
            <button onClick={() => setShowAdvanced(v => !v)}
              style={{ background: 'none', border: 'none', color: '#475569', fontSize: 12, cursor: 'pointer', padding: '6px 0', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ display: 'inline-block', transform: showAdvanced ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .2s', fontSize: 10 }}>▶</span>
              {showAdvanced ? 'Hide context' : 'Edit JD / resume context'}
            </button>
            {showAdvanced && (
              <div style={{ ...G.card, marginTop: 10 }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={G.label}>Your Resume / Skills</label>
                  <textarea value={resumeText} onChange={e => setResumeSynced(e.target.value)} rows={3} style={G.input} placeholder="Skills, experience, projects…" />
                </div>
                <div>
                  <label style={G.label}>Job Description</label>
                  <textarea value={jd} onChange={e => setJdSynced(e.target.value)} rows={4} style={G.input} placeholder="Paste JD or skill list…" />
                </div>
              </div>
            )}
          </div>

          {/* ── Warnings ── */}
          {!supported && (
            <div style={{ background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.18)', borderRadius: 12, padding: '11px 15px', marginBottom: '1rem', fontSize: 13, color: '#fbbf24', display: 'flex', gap: 10, alignItems: 'center' }}>
              <span>⚠️</span> Voice recognition works best in Chrome or Edge.
            </div>
          )}
          {error && (
            <div style={{ background: 'rgba(248,113,113,.06)', border: '1px solid rgba(248,113,113,.18)', borderRadius: 12, padding: '11px 15px', marginBottom: '1rem', fontSize: 13, color: '#f87171', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ flexShrink: 0 }}>⚠️</span> {error}
            </div>
          )}

          {/* ── Camera CTA ── */}
          {camStatus !== 'granted' ? (
            <button onClick={() => requestCam()}
              style={{ ...G.btnPrimary, background: 'rgba(99,102,241,.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,.28)', boxShadow: 'none', marginBottom: 12, fontSize: 14 }}>
              📷 Enable Camera to begin
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '11px', borderRadius: 14, background: 'rgba(52,211,153,.06)', border: '1px solid rgba(52,211,153,.2)', color: '#34d399', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', display: 'inline-block', boxShadow: '0 0 8px #34d399' }} />
              Camera ready
            </div>
          )}

          <button onClick={startInterview} disabled={loading || camStatus !== 'granted'}
            style={{ ...G.btnPrimary, opacity: (loading || camStatus !== 'granted') ? 0.35 : 1, cursor: (loading || camStatus !== 'granted') ? 'not-allowed' : 'pointer', fontSize: 16, padding: '15px' }}>
            {loading ? '⏳ Generating questions…' : '🚀 Start Interview'}
          </button>
        </div>
      </div>
    )
  }

  // ── RENDER: PROCESSING ────────────────────────────────────────────────────
  if (stage === STAGE.PROCESSING) {
    return (
      <div style={{ ...G.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: 340 }}>
          {/* Animated brain orb */}
          <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 2rem' }}>
            <div style={{ position: 'absolute', inset: -18, borderRadius: '50%', background: 'rgba(99,102,241,.06)', animation: 'orbPulse 2s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', background: 'rgba(99,102,241,.1)', animation: 'orbPulse 2s ease-in-out infinite .5s' }} />
            <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,.25) 0%,rgba(99,102,241,.06) 100%)', border: '2px solid rgba(99,102,241,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, position: 'relative', zIndex: 1 }}>
              🧠
            </div>
          </div>
          <h3 style={{ fontWeight: 800, marginBottom: 10, fontSize: 20, letterSpacing: '-.02em' }}>Analysing your interview…</h3>
          <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6, marginBottom: '2rem' }}>Grading {transcript.length} answers · Generating personalised resources</p>
          {/* Shimmer bar */}
          <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,.05)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: '60%', height: '100%', background: 'linear-gradient(90deg,transparent,#6366f1,#8b5cf6,transparent)', borderRadius: 4, animation: 'shimmer 1.6s ease-in-out infinite' }} />
          </div>
          <style>{`@keyframes orbPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.1);opacity:.6}} @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}`}</style>
        </div>
      </div>
    )
  }

  // ── RENDER: INTERVIEW ─────────────────────────────────────────────────────
  if ([STAGE.SPEAKING, STAGE.LISTENING, STAGE.BETWEEN].includes(stage as never)) {
    const isSpeaking  = stage === STAGE.SPEAKING
    const isListening = stage === STAGE.LISTENING
    const isBetween   = stage === STAGE.BETWEEN
    const totalViol   = violations.tab + violations.fs + violations.face

    return (
      <div style={{ ...G.page, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Hidden face detection video */}
        {camStream && <video ref={faceVidCb} autoPlay muted playsInline style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', width: 1, height: 1, top: -9999 }} />}

        {/* ── Floating camera PiP ── */}
        {camStream && (
          <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 50, borderRadius: 16, overflow: 'hidden', width: 160, height: 108, border: '2px solid rgba(255,255,255,.12)', boxShadow: '0 8px 32px rgba(0,0,0,.6)', background: '#000' }}>
            <video ref={bgVidCb} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            <div style={{ position: 'absolute', top: 7, left: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171', animation: 'dotPulse 1.8s ease-in-out infinite' }} />
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', color: 'rgba(255,255,255,.8)' }}>LIVE</span>
            </div>
          </div>
        )}

        {/* ── Top bar ── */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,.3)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 40 }}>
          {/* Step dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {questions.map((_, i) => {
              const done = i < qIdx || (i === qIdx && isBetween)
              const cur  = i === qIdx && !isBetween
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: cur ? 28 : 8, height: 8, borderRadius: 4,
                    background: done ? '#6366f1' : cur ? 'linear-gradient(90deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,.1)',
                    transition: 'all .4s ease',
                    boxShadow: cur ? '0 0 10px rgba(99,102,241,.5)' : 'none',
                  }} />
                </div>
              )
            })}
            <span style={{ marginLeft: 6, fontSize: 12, color: '#475569', fontWeight: 600 }}>
              {qIdx + 1}/{questions.length}
            </span>
          </div>

          {/* Right controls */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {totalViol > 0 && (
              <span style={{ fontSize: 11, color: '#f87171', background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 20, padding: '3px 10px' }}>
                ⚠️ {totalViol}/3
              </span>
            )}
            <span style={{ fontSize: 13, color: '#475569', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(elapsed)}</span>
            <button onClick={() => setMuted(m => !m)} style={{ ...G.btnGhost, padding: '6px 14px', fontSize: 12, borderRadius: 20 }}>
              {muted ? '🔇' : '🔊'}
            </button>
          </div>
        </div>

        {/* ── Main content ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem 6rem', maxWidth: 680, margin: '0 auto', width: '100%' }}>

          {/* Violation warning */}
          {warning && (
            <div style={{ width: '100%', background: autoSubRef.current ? 'rgba(239,68,68,.1)' : 'rgba(251,191,36,.07)', border: `1px solid ${autoSubRef.current ? 'rgba(239,68,68,.3)' : 'rgba(251,191,36,.22)'}`, borderRadius: 14, padding: '12px 16px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 12, animation: 'shakeAnim .5s' }}>
              <span style={{ fontSize: 22 }}>{autoSubRef.current ? '🚫' : '⚠️'}</span>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: autoSubRef.current ? '#f87171' : '#fbbf24' }}>{warning}</p>
            </div>
          )}

          {/* ── State badge ── */}
          <div style={{ marginBottom: '1.5rem' }}>
            {isSpeaking && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 18px', borderRadius: 20, background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.3)', color: '#a5b4fc', fontSize: 13, fontWeight: 600 }}>
                <Bars active color="#818cf8" />
                AI is speaking…
              </div>
            )}
            {isListening && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 18px', borderRadius: 20, background: 'rgba(52,211,153,.1)', border: '1px solid rgba(52,211,153,.3)', color: '#34d399', fontSize: 13, fontWeight: 600 }}>
                <Bars active color="#34d399" />
                Listening — speak now
              </div>
            )}
            {isBetween && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 20, background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.22)', color: '#fbbf24', fontSize: 13, fontWeight: 600 }}>
                ✓ Answer recorded
              </div>
            )}
          </div>

          {/* ── Question ── */}
          <div style={{ ...G.card, width: '100%', padding: '2rem', marginBottom: '1.5rem', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)' }}>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              {job.title} · {job.companyName}
            </p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 600, lineHeight: 1.65, color: '#f1f5f9', letterSpacing: '-.01em' }}>
              {questions[qIdx]}
            </p>
          </div>

          {/* ── SPEAKING: skip to answer ── */}
          {isSpeaking && (
            <button onClick={() => { stopSpeaking(); setStage(STAGE.LISTENING) }}
              style={{ padding: '11px 28px', borderRadius: 12, border: '1px solid rgba(99,102,241,.3)', background: 'rgba(99,102,241,.1)', color: '#a5b4fc', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              🎤 Answer now (skip AI reading)
            </button>
          )}

          {/* ── LISTENING: mic orb + transcript ── */}
          {isListening && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
              <MicOrb active />

              {/* Live transcript */}
              <div style={{ width: '100%', minHeight: 64, padding: '14px 18px', borderRadius: 14, background: 'rgba(52,211,153,.05)', border: '1px solid rgba(52,211,153,.15)', textAlign: 'center' }}>
                {liveText
                  ? <p style={{ margin: 0, fontSize: 15, color: '#94a3b8', fontStyle: 'italic', lineHeight: 1.65 }}>"{liveText}"</p>
                  : <p style={{ margin: 0, fontSize: 13, color: '#1e3a2f' }}>Your words will appear here as you speak…</p>
                }
                {sttMode === 'whisper' && (
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#1e3a2f' }}>Recording via microphone</p>
                )}
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={() => { stopSpeaking(); speakQ(qIdx) }}
                  style={{ ...G.btnGhost, fontSize: 13 }}>
                  🔊 Replay
                </button>
                <button onClick={skipQuestion}
                  style={{ ...G.btnGhost, fontSize: 13, color: '#334155', borderColor: 'rgba(255,255,255,.05)' }}>
                  Skip →
                </button>
                <button onClick={submitAnswer}
                  style={{ padding: '11px 32px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#34d399,#059669)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 0 24px rgba(52,211,153,.3)' }}>
                  Done ✓
                </button>
              </div>
            </div>
          )}

          {/* ── BETWEEN: answer review ── */}
          {isBetween && transcript.length > 0 && (
            <div style={{ width: '100%' }}>
              <div style={{ padding: '16px 20px', borderRadius: 16, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', marginBottom: '1rem' }}>
                <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '.07em' }}>Your answer</p>
                <p style={{ margin: 0, fontSize: 14, color: '#94a3b8', lineHeight: 1.7 }}>
                  {transcript[transcript.length - 1].answer || <em style={{ color: '#334155' }}>No answer recorded</em>}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={reAnswer} style={{ ...G.btnGhost, flex: 1, textAlign: 'center' as const }}>↩ Re-answer</button>
                <button onClick={nextQuestion}
                  style={{ flex: 2, padding: '12px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 0 24px rgba(99,102,241,.35)' }}>
                  {qIdx + 1 < questions.length ? 'Next Question →' : '✨ Finish & Get Report →'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Previous answers accordion ── */}
        {transcript.length > 0 && (
          <div style={{ maxWidth: 680, margin: '0 auto', width: '100%', padding: '0 1rem 2rem' }}>
            <details style={{ ...G.card, marginBottom: 0 }}>
              <summary style={{ fontSize: 13, color: '#475569', cursor: 'pointer', fontWeight: 600 }}>
                {transcript.length} answered · {questions.length - transcript.length} remaining
              </summary>
              <div style={{ marginTop: '1rem' }}>
                {transcript.map((t, i) => (
                  <div key={i} style={{ borderLeft: '2px solid rgba(99,102,241,.3)', paddingLeft: 14, marginBottom: '1rem' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 11, color: '#334155', fontWeight: 700 }}>Q{i + 1}</p>
                    <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{t.question}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>{t.answer}</p>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}

        <style>{`
          @keyframes dotPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(1.5)}}
          @keyframes shakeAnim{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-5px)}40%,80%{transform:translateX(5px)}}
          @keyframes orbPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.12);opacity:.6}}
        `}</style>
      </div>
    )
  }

  // ── RENDER: REPORT ────────────────────────────────────────────────────────
  if (stage === STAGE.REPORT && feedback) {
    const score  = feedback.overallScore ?? 0
    const sc     = score >= 75 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171'
    const scBg   = score >= 75 ? 'rgba(52,211,153,.07)' : score >= 50 ? 'rgba(251,191,36,.07)' : 'rgba(248,113,113,.07)'
    const grade  = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Needs Work'

    return (
      <div style={G.page}>
        <Navbar />
        <div style={{ maxWidth: 660, margin: '0 auto', padding: '2rem 1rem 4rem' }}>

          {/* ── Score hero ── */}
          <div style={{ ...G.card, textAlign: 'center', padding: '2.5rem 2rem', background: scBg, border: `1px solid ${sc}22`, marginBottom: '1.5rem' }}>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              {job.title} · {job.companyName}
            </p>
            <h2 style={{ margin: '0 0 2rem', fontSize: 24, fontWeight: 800, letterSpacing: '-.03em' }}>Interview Complete</h2>

            <div style={{ display: 'inline-flex', position: 'relative', marginBottom: '1rem' }}>
              <ScoreRing pct={score} size={140} stroke={11} color={sc} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 38, fontWeight: 900, color: sc, lineHeight: 1 }}>{score}</span>
                <span style={{ fontSize: 12, color: '#334155', marginTop: 2 }}>/ 100</span>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: sc, background: `${sc}18`, border: `1px solid ${sc}40`, borderRadius: 20, padding: '5px 18px', letterSpacing: '.02em' }}>
                {grade}
              </span>
            </div>

            <p style={{ margin: '0 auto 1rem', fontSize: 14, color: '#64748b', lineHeight: 1.7, maxWidth: 460 }}>
              {feedback.overallAssessment}
            </p>

            {feedback.violations && Object.values(feedback.violations).some(v => v > 0) && (
              <p style={{ margin: 0, fontSize: 11, color: '#334155' }}>
                Violations — Tab: {feedback.violations.tab} · Fullscreen: {feedback.violations.fs} · Camera: {feedback.violations.face}
                {feedback.autoSubmitted && <span style={{ color: '#f87171', marginLeft: 10 }}>⚠️ Auto-submitted</span>}
              </p>
            )}
          </div>

          {/* ── Category scores ── */}
          <div style={{ ...G.card }}>
            <p style={{ ...G.label, marginBottom: 14 }}>Category Scores</p>
            {SCORE_CATS.map(c => <ScoreLine key={c.key} label={c.label} icon={c.icon} score={feedback.categoryScores?.[c.key] ?? 0} />)}
          </div>

          {/* ── Strengths + Improvements ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ ...G.card, marginBottom: 0, background: 'rgba(52,211,153,.04)', border: '1px solid rgba(52,211,153,.15)' }}>
              <p style={{ ...G.label, color: '#34d399', marginBottom: 12 }}>✅ Strengths</p>
              {(feedback.strengths || []).map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: '#34d399', flexShrink: 0, marginTop: 1 }}>•</span>
                  <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.55 }}>{s}</p>
                </div>
              ))}
            </div>
            <div style={{ ...G.card, marginBottom: 0, background: 'rgba(248,113,113,.04)', border: '1px solid rgba(248,113,113,.15)' }}>
              <p style={{ ...G.label, color: '#f87171', marginBottom: 12 }}>📈 To Improve</p>
              {(feedback.improvements || []).map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }}>•</span>
                  <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.55 }}>{s}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Question breakdown ── */}
          <div style={{ ...G.card, marginTop: '1rem' }}>
            <p style={{ ...G.label, marginBottom: '1.25rem' }}>Question Breakdown</p>
            {(feedback.perQuestionFeedback || []).map((q, i) => {
              const qc  = q.score >= 70 ? '#34d399' : q.score >= 40 ? '#fbbf24' : '#f87171'
              const qbg = q.score >= 70 ? 'rgba(52,211,153,.04)' : q.score >= 40 ? 'rgba(251,191,36,.04)' : 'rgba(248,113,113,.04)'
              return (
                <div key={i} style={{ borderLeft: `3px solid ${qc}`, paddingLeft: 16, marginBottom: '1.75rem', paddingTop: 4, paddingBottom: 4, background: qbg, borderRadius: '0 12px 12px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>Question {i + 1}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: qc, background: `${qc}18`, borderRadius: 20, padding: '2px 12px' }}>{q.score}/100</span>
                  </div>
                  <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.55 }}>{q.question}</p>
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: '#64748b', lineHeight: 1.65 }}>{q.feedback}</p>
                  <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(255,255,255,.06)' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>Ideal answer: </span>
                    <span style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{q.idealAnswer}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Learning resources ── */}
          {(feedback.learningResources || []).length > 0 && (
            <div style={{ ...G.card }}>
              <p style={{ ...G.label, marginBottom: '1.25rem' }}>📚 Learning Resources</p>
              {feedback.learningResources.map((item, i) => (
                <div key={i} style={{ marginBottom: '1.5rem' }}>
                  <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#a5b4fc' }}>{item.skill}</p>
                  {(item.resources || []).map((r, j) => {
                    let host = ''
                    try { host = new URL(r.url).hostname.replace('www.', '') } catch (_) {}
                    return (
                      <a key={j} href={r.url} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', marginBottom: 7, textDecoration: 'none', transition: 'background .15s' }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{r.type === 'video' ? '▶️' : r.type === 'docs' ? '📖' : '🔗'}</span>
                        <span style={{ flex: 1, fontSize: 13, color: '#cbd5e1', fontWeight: 500 }}>{r.title}</span>
                        <span style={{ fontSize: 11, color: '#334155', background: 'rgba(255,255,255,.04)', borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>{host}</span>
                      </a>
                    )
                  })}
                </div>
              ))}
            </div>
          )}

          {/* ── Trending technologies ── */}
          {(feedback.trendingTechnologies || []).length > 0 && (
            <div style={{ ...G.card }}>
              <p style={{ ...G.label, marginBottom: '1.25rem' }}>🚀 Trending Technologies</p>
              {feedback.trendingTechnologies.map((t, i) => {
                let host = ''
                try { host = new URL(t.resource?.url || '').hostname.replace('www.', '') } catch (_) {}
                return (
                  <div key={i} style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: i < feedback.trendingTechnologies.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>{t.name}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.55 }}>{t.reason}</p>
                    </div>
                    {t.resource?.url && (
                      <a href={t.resource.url} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 12, background: 'rgba(99,102,241,.09)', border: '1px solid rgba(99,102,241,.2)', textDecoration: 'none', color: '#818cf8', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        <span style={{ fontSize: 16 }}>{t.resource.type === 'video' ? '▶️' : '📖'}</span>
                        <span>{host}</span>
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Transcript ── */}
          <details style={{ ...G.card }}>
            <summary style={{ fontSize: 13, color: '#475569', cursor: 'pointer', fontWeight: 600 }}>
              View full transcript ({transcript.length} questions)
            </summary>
            <div style={{ marginTop: '1.25rem' }}>
              {transcript.map((t, i) => (
                <div key={i} style={{ borderLeft: '2px solid rgba(99,102,241,.3)', paddingLeft: 14, marginBottom: '1.5rem' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#334155' }}>Q{i + 1}</p>
                  <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{t.question}</p>
                  <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.6 }}>{t.answer}</p>
                </div>
              ))}
            </div>
          </details>

          {/* ── Actions ── */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={reset} style={{ ...G.btnGhost, flex: 1, textAlign: 'center' as const }}>↩ Retry</button>
            <button onClick={() => {
              const txt = [
                `Interview Report — ${job.title} at ${job.companyName}`,
                `Overall Score: ${score}/100 (${grade})`,
                `\nCategory Scores:`,
                ...SCORE_CATS.map(c => `  ${c.label}: ${feedback.categoryScores?.[c.key] ?? 0}/100`),
                `\nAssessment:\n  ${feedback.overallAssessment}`,
                `\nStrengths:\n${(feedback.strengths || []).map(s => '  • ' + s).join('\n')}`,
                `\nImprovements:\n${(feedback.improvements || []).map(s => '  • ' + s).join('\n')}`,
              ].join('\n')
              const a = document.createElement('a')
              a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }))
              a.download = 'interview-report.txt'; a.click()
            }} style={{ ...G.btnPrimary, flex: 2, boxShadow: 'none' }}>
              ↓ Download Report
            </button>
          </div>

        </div>
      </div>
    )
  }

  return null
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
function InterviewContent() {
  const searchParams = useSearchParams()
  const jobId = searchParams.get('jobId') || ''

  const { data: job, isLoading: jobLoading } = useQuery<Job>({
    queryKey: ['job', jobId],
    queryFn: () => fetch(`/api/jobs/${jobId}`).then(r => r.json()),
    enabled: !!jobId,
  })

  const { data: profile } = useQuery({
    queryKey: ['candidate-profile'],
    queryFn: () => fetch('/api/candidate/profile').then(r => r.json()),
  })

  if (!jobId) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <p className="text-muted-foreground">Please select a job to start an interview.</p>
          <Link href="/candidate/applications" className="mt-4 inline-block text-violet-400 hover:text-violet-300 text-sm">
            ← Go to applications
          </Link>
        </div>
      </div>
    )
  }

  if (jobLoading || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-violet-500" />
      </div>
    )
  }

  // Build initial resume text from candidate profile
  const initialResumeText = (() => {
    if (!profile) return ''
    const skills = (profile.skills as Array<{ skill: string }> | undefined)?.map(s => s.skill).join(', ')
      || (profile.skillGroups as Array<{ skills: string[] }> | undefined)?.flatMap(g => g.skills).join(', ')
      || ''
    const parts = [
      profile.summary ? `Summary: ${profile.summary}` : '',
      skills ? `Skills: ${skills}` : '',
    ].filter(Boolean)
    return parts.join('\n')
  })()

  return <VoiceInterview job={job} initialResumeText={initialResumeText} />
}

export default function InterviewPage() {
  return (
    <Suspense>
      <InterviewContent />
    </Suspense>
  )
}
