import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/db'
import Job from '@/lib/models/Job'
import CandidateProfile from '@/lib/models/CandidateProfile'
import Application from '@/lib/models/Application'
import User from '@/lib/models/User'
import { callGroqJSON, MODELS } from '@/lib/groq'
import { PROMPTS } from '@/lib/ai/prompts'

// ── GET: original skill gap (JD vs candidate profile) ────────────────────────
export async function GET(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'candidate') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId')
  const applicationId = searchParams.get('applicationId')
  const regenerate = searchParams.get('regenerate') === 'true'

  await connectDB()

  const profile = await CandidateProfile.findOne({ userId: session.user.id }).lean() as {
    skills?: Array<{ skill?: string; name?: string; proficiency?: string; level?: string }>
  } | null

  let job: { title?: string; requiredSkills?: Array<{ skill: string; weight: number }> } | null = null
  let existingGap: { missingSkills?: unknown[] } | null = null

  if (jobId) {
    job = await Job.findById(jobId).lean()
  } else if (applicationId) {
    const app = await Application.findById(applicationId).lean() as {
      jobId: unknown
      skillGapPath?: { missingSkills?: unknown[] }
    } | null
    if (app) {
      job = await Job.findById(app.jobId).lean()
      existingGap = app.skillGapPath ?? null
    }
  }

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  // Only use the cache if it has real content and regenerate isn't forced
  if (!regenerate && existingGap && (existingGap.missingSkills?.length ?? 0) > 0) {
    return NextResponse.json(existingGap)
  }

  // Find missing skills — compare against both {skill} and {name} field shapes
  const candidateSkillNames = (profile?.skills || [])
    .map((s) => (s.skill || s.name || '').toLowerCase())
    .filter(Boolean)

  const requiredSkills = job.requiredSkills || []

  const missingSkills = requiredSkills
    .filter((s) => {
      const jSkill = s.skill.toLowerCase()
      return !candidateSkillNames.some((c) => c.includes(jSkill) || jSkill.includes(c))
    })
    .slice(0, 5)

  // If candidate has all required skills (or job has no required skills)
  if (missingSkills.length === 0) {
    const result = {
      missingSkills: [],
      allSkillsMatched: true,
      matchedCount: candidateSkillNames.length,
      requiredCount: requiredSkills.length,
      timeline: null,
      steps: [],
    }
    return NextResponse.json(result)
  }

  try {
    interface SkillGapResult {
      skill: string
      weeklyPlan: string[]
      resources: Array<{ title: string; url: string; type: string }>
    }

    const plans = await Promise.all(
      missingSkills.map(async (s) => {
        const prompt = PROMPTS.SKILL_GAP_PATH(s.skill)
        try {
          return await callGroqJSON<SkillGapResult>(MODELS.SMART, prompt)
        } catch {
          return { skill: s.skill, weeklyPlan: [], resources: [] }
        }
      })
    )

    const result = {
      missingSkills: missingSkills.map((s, i) => ({
        skill: s.skill,
        priority: s.weight === 3 ? 'high' : s.weight === 2 ? 'medium' : 'low',
        resources: plans[i]?.resources || [],
        weeklyPlan: plans[i]?.weeklyPlan || [],
      })),
      allSkillsMatched: false,
      timeline: `${missingSkills.length * 2}–${missingSkills.length * 3} weeks`,
      steps: plans.flatMap((p, pi) =>
        (p.weeklyPlan || []).map((focus, wi) => ({
          week: pi * 3 + wi + 1,
          focus: p.skill,
          tasks: [focus],
        }))
      ).slice(0, 8),
    }

    if (applicationId) {
      await Application.findByIdAndUpdate(applicationId, { skillGapPath: result })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('Skill gap error:', err)
    return NextResponse.json({ error: 'Failed to generate analysis' }, { status: 500 })
  }
}

// ── POST: contextual rejection analysis (recruiter notes + hired comparison) ──
export async function POST(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'candidate') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { applicationId } = await req.json()
    if (!applicationId) return NextResponse.json({ error: 'applicationId required' }, { status: 400 })

    await connectDB()

    // Load the rejected application
    const app = await Application.findOne({
      _id: applicationId,
      candidateId: session.user.id,
    }).lean() as {
      jobId: unknown
      candidateId: unknown
      matchScore?: { overall?: number }
      breakdown?: Array<{ skill: string; match: string; weight: number }>
      recruiterNotes?: string
      stageHistory?: Array<{ stage: string; note?: string; timestamp: Date }>
      outcome?: string
    } | null

    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    if (app.outcome !== 'rejected') {
      return NextResponse.json({ error: 'Application is not rejected' }, { status: 400 })
    }

    // Load job
    const job = await Job.findById(app.jobId).lean() as {
      title?: string
      description?: string
      requiredSkills?: Array<{ skill: string; weight: number; type: string }>
    } | null
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    // Load candidate profile
    const profile = await CandidateProfile.findOne({ userId: session.user.id }).lean() as {
      skills?: Array<{ skill?: string; name?: string }>
    } | null

    const candidateSkillNames = (profile?.skills || [])
      .map((s) => s.skill || s.name || '')
      .filter(Boolean)

    // Get missing skills from breakdown
    const missingSkillsFromJD = (app.breakdown || [])
      .filter((b) => b.match === 'none')
      .map((b) => b.skill)

    // Collect recruiter stage notes (non-empty notes from stageHistory, last 5)
    const recruiterStageNotes = (app.stageHistory || [])
      .map((h) => h.note || '')
      .filter((n) => n.trim().length > 0)
      .slice(-5)

    // Fetch hired/shortlisted candidates for same job (top 3 by score)
    const hiredApps = await Application.find({
      jobId: app.jobId,
      $or: [{ outcome: 'hired' }, { stage: 'shortlisted' }, { stage: 'interview' }],
      candidateId: { $ne: session.user.id },
    })
      .sort({ 'matchScore.overall': -1 })
      .limit(3)
      .lean() as Array<{
        candidateId: unknown
        matchScore?: { overall?: number }
      }>

    // Get hired candidates' profiles and names
    const hiredCandidatesSkills: Array<{ name: string; skills: string[] }> = []
    for (const ha of hiredApps) {
      const [hUser, hProfile] = await Promise.all([
        User.findById(ha.candidateId).select('name').lean() as Promise<{ name?: string } | null>,
        CandidateProfile.findOne({ userId: ha.candidateId }).select('skills').lean() as Promise<{
          skills?: Array<{ skill?: string; name?: string }>
        } | null>,
      ])
      if (hProfile?.skills?.length) {
        hiredCandidatesSkills.push({
          name: hUser?.name || 'Selected Candidate',
          skills: hProfile.skills.map((s) => s.skill || s.name || '').filter(Boolean).slice(0, 10),
        })
      }
    }

    // Build the contextual rejection analysis using Groq
    const prompt = PROMPTS.CONTEXTUAL_REJECTION({
      jobTitle: job.title || 'this role',
      jobDescription: job.description || '',
      requiredSkills: job.requiredSkills || [],
      candidateSkills: candidateSkillNames,
      candidateMatchScore: app.matchScore?.overall ?? 0,
      recruiterNotes: app.recruiterNotes || '',
      recruiterStageNotes,
      hiredCandidatesSkills,
      missingSkillsFromJD,
    })

    interface RejectionAnalysis {
      summary: string
      recruiterFeedbackInsight: string
      topGaps: Array<{
        skill: string
        gapType: string
        reason: string
        priority: string
      }>
      comparedToSelected: string | null
      actionableSteps: string[]
      encouragement: string
    }

    const analysis = await callGroqJSON<RejectionAnalysis>(MODELS.SMART, prompt)

    // Cache the analysis into the application document
    await Application.findByIdAndUpdate(applicationId, {
      'skillGapPath.rejectionAnalysis': analysis,
    })

    return NextResponse.json(analysis)
  } catch (err) {
    console.error('Contextual rejection analysis error:', err)
    return NextResponse.json({ error: 'Failed to generate rejection analysis' }, { status: 500 })
  }
}
