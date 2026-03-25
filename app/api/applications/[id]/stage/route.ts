import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/db'
import Application from '@/lib/models/Application'
import Job from '@/lib/models/Job'
import User from '@/lib/models/User'
import CandidateProfile from '@/lib/models/CandidateProfile'
import { triggerStageUpdate } from '@/lib/pusher-server'
import { callGroqJSON, MODELS } from '@/lib/groq'
import { PROMPTS } from '@/lib/ai/prompts'
import { sendStageUpdate, sendRejectionEmail, sendHiredEmail } from '@/lib/mailer'

const VALID_STAGES = ['applied', 'under_review', 'shortlisted', 'interview', 'decision', 'outcome'] as const
type Stage = typeof VALID_STAGES[number]

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'recruiter') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { stage, note, outcome } = await req.json()
    if (!VALID_STAGES.includes(stage as Stage)) {
      return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
    }

    await connectDB()

    const application = await Application.findById(params.id).lean() as {
      jobId: unknown
      candidateId: unknown
      _id: unknown
      matchScore?: { overall?: number }
      breakdown?: Array<{ skill: string; match: string; weight: number }>
      recruiterNotes?: string
      stageHistory?: Array<{ stage: string; note?: string; timestamp: Date }>
    } | null
    if (!application) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Verify recruiter owns this job
    const job = await Job.findOne({ _id: application.jobId, recruiterId: session.user.id }).lean() as {
      _id: unknown
      title?: string
      description?: string
      companyName?: string
      location?: string
      workType?: string
      salaryRange?: { min: number; max: number; currency: string }
      requiredSkills?: Array<{ skill: string; weight: number; type: string }>
    } | null
    if (!job) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const updated = await Application.findByIdAndUpdate(
      params.id,
      {
        stage,
        ...(outcome ? { outcome } : {}),
        $push: {
          stageHistory: {
            stage,
            timestamp: new Date(),
            note: note || '',
            changedBy: session.user.id,
          },
        },
      },
      { new: true }
    )

    // Pusher real-time notification
    try {
      await triggerStageUpdate(
        String(application.jobId),
        String(params.id),
        stage
      )
    } catch {
      console.warn('Pusher trigger failed')
    }

    // ── Fire-and-forget email (stage update or rejection) ─────────────
    ;(async () => {
      try {
        const [candidateUser, jobDoc, recruiterUser] = await Promise.all([
          User.findById(application.candidateId).select('name email').lean() as Promise<{ name?: string; email?: string } | null>,
          Job.findById(application.jobId).select('title companyName location workType salaryRange').lean() as Promise<{
            title?: string
            companyName?: string
            location?: string
            workType?: string
            salaryRange?: { min: number; max: number; currency: string }
          } | null>,
          User.findById(session.user.id).select('name').lean() as Promise<{ name?: string } | null>,
        ])

        if (candidateUser?.email && jobDoc) {
          if (outcome === 'rejected') {
            await sendRejectionEmail({
              to: candidateUser.email,
              candidateName: candidateUser.name || 'there',
              jobTitle: jobDoc.title || 'this role',
              companyName: jobDoc.companyName || '',
              matchScore: (application as { matchScore?: { overall?: number } }).matchScore?.overall ?? 0,
              applicationId: String(params.id),
              recruiterNote: note || '',
            })
          } else if (outcome === 'hired') {
            await sendHiredEmail({
              to: candidateUser.email,
              candidateName: candidateUser.name || 'there',
              jobTitle: jobDoc.title || 'this role',
              companyName: jobDoc.companyName || '',
              recruiterName: recruiterUser?.name || 'Hiring Manager',
              location: jobDoc.location,
              workType: jobDoc.workType,
              salaryRange: jobDoc.salaryRange,
              recruiterNote: note || '',
            })
          } else {
            await sendStageUpdate({
              to: candidateUser.email,
              candidateName: candidateUser.name || 'there',
              jobTitle: jobDoc.title || 'this role',
              companyName: jobDoc.companyName || '',
              newStage: stage,
              recruiterNote: note || '',
              applicationId: String(params.id),
            })
          }
        }
      } catch (emailErr) {
        console.error('[Email] Stage email failed:', emailErr)
      }
    })()

    // ── Auto-generate contextual rejection analysis when candidate is rejected ──
    if (outcome === 'rejected' || (stage === 'outcome' && outcome === 'rejected')) {
      // Fire-and-forget in background so the PATCH response is not delayed
      ;(async () => {
        try {
          // Get candidate profile + skills
          const [profile, candidateUser] = await Promise.all([
            CandidateProfile.findOne({ userId: application.candidateId }).lean() as Promise<{
              skills?: Array<{ skill?: string; name?: string }>
            } | null>,
            User.findById(application.candidateId).select('name').lean() as Promise<{ name?: string } | null>,
          ])

          const candidateSkillNames = (profile?.skills || [])
            .map((s) => s.skill || s.name || '')
            .filter(Boolean)

          // Missing skills from stored breakdown
          const missingSkillsFromJD = (application.breakdown || [])
            .filter((b) => b.match === 'none')
            .map((b) => b.skill)

          // Collect all non-empty stage notes, including the current one being added
          const allStageNotes = [
            ...((application.stageHistory || []).map((h) => h.note || '').filter((n) => n.trim())),
            ...(note?.trim() ? [note.trim()] : []),
          ].slice(-5)

          // Get hired/shortlisted candidates for same job
          const hiredApps = await Application.find({
            jobId: application.jobId,
            $or: [{ outcome: 'hired' }, { stage: 'shortlisted' }, { stage: 'interview' }],
            candidateId: { $ne: application.candidateId },
          })
            .sort({ 'matchScore.overall': -1 })
            .limit(3)
            .lean() as Array<{ candidateId: unknown }>

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

          // Get recruiter notes from updated doc
          const freshApp = await Application.findById(params.id).select('recruiterNotes').lean() as { recruiterNotes?: string } | null

          const prompt = PROMPTS.CONTEXTUAL_REJECTION({
            jobTitle: job.title || 'this role',
            jobDescription: job.description || '',
            requiredSkills: job.requiredSkills || [],
            candidateSkills: candidateSkillNames,
            candidateMatchScore: application.matchScore?.overall ?? 0,
            recruiterNotes: freshApp?.recruiterNotes || '',
            recruiterStageNotes: allStageNotes,
            hiredCandidatesSkills,
            missingSkillsFromJD,
          })

          interface RejectionAnalysis {
            summary: string
            recruiterFeedbackInsight: string
            topGaps: Array<{ skill: string; gapType: string; reason: string; priority: string }>
            comparedToSelected: string | null
            actionableSteps: string[]
            encouragement: string
          }

          const analysis = await callGroqJSON<RejectionAnalysis>(MODELS.SMART, prompt)

          await Application.findByIdAndUpdate(params.id, {
            'skillGapPath.rejectionAnalysis': analysis,
          })

          console.log(`[NexusHire] Contextual rejection analysis saved for application ${params.id}`)
        } catch (bgErr) {
          console.error('[NexusHire] Background rejection analysis failed:', bgErr)
        }
      })()
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Stage update error:', err)
    return NextResponse.json({ error: 'Failed to update stage' }, { status: 500 })
  }
}
