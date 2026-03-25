import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Application from '@/lib/models/Application'
import Job from '@/lib/models/Job'
import User from '@/lib/models/User'
import { sendDailyPipelineSummary } from '@/lib/mailer'

// This route is called by an external cron service (e.g. cron-job.org) once per day.
// Protect with a shared secret to prevent unauthorized calls.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()

  // Window: last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // Get all new applications in the last 24h
  const newApps = await Application.find({ appliedAt: { $gte: since } })
    .select('jobId matchScore')
    .lean() as Array<{ jobId: unknown; matchScore: { overall?: number } | number }>

  if (newApps.length === 0) {
    return NextResponse.json({ message: 'No new applications — skipped' })
  }

  // Group by jobId
  const byJob: Record<string, { count: number; highMatch: number }> = {}
  for (const app of newApps) {
    const key = String(app.jobId)
    const score = typeof app.matchScore === 'object' ? (app.matchScore?.overall ?? 0) : (app.matchScore ?? 0)
    if (!byJob[key]) byJob[key] = { count: 0, highMatch: 0 }
    byJob[key].count++
    if (score >= 75) byJob[key].highMatch++
  }

  // For each affected job, get recruiter and send summary
  const emailsSent: string[] = []

  // Group by recruiterId so each recruiter gets one email covering all their jobs
  const recruiterJobs: Record<string, Array<{ jobId: string; title: string; newApplicants: number; highMatchCount: number }>> = {}

  for (const [jobId, stats] of Object.entries(byJob)) {
    const job = await Job.findById(jobId).select('title recruiterId').lean() as {
      title?: string; recruiterId?: unknown
    } | null
    if (!job?.recruiterId) continue

    const recruiterId = String(job.recruiterId)
    if (!recruiterJobs[recruiterId]) recruiterJobs[recruiterId] = []
    recruiterJobs[recruiterId].push({
      jobId,
      title: job.title || 'Untitled Job',
      newApplicants: stats.count,
      highMatchCount: stats.highMatch,
    })
  }

  for (const [recruiterId, jobs] of Object.entries(recruiterJobs)) {
    const recruiter = await User.findById(recruiterId).select('name email').lean() as {
      name?: string; email?: string
    } | null
    if (!recruiter?.email) continue

    const totalNew = jobs.reduce((s: number, j: { newApplicants: number }) => s + j.newApplicants, 0)
    const totalHighMatch = jobs.reduce((s: number, j: { highMatchCount: number }) => s + j.highMatchCount, 0)

    await sendDailyPipelineSummary({
      to: recruiter.email,
      recruiterName: recruiter.name || 'there',
      summary: jobs.map((j: { jobId: string; title: string; newApplicants: number; highMatchCount: number }) => ({
        jobTitle: j.title,
        newApplicants: j.newApplicants,
        highMatchCount: j.highMatchCount,
        jobId: j.jobId,
      })),
      totalNew,
      totalHighMatch,
    })

    emailsSent.push(recruiter.email)
  }

  return NextResponse.json({
    message: `Daily summary sent to ${emailsSent.length} recruiter(s)`,
    recruiterEmails: emailsSent,
  })
}
