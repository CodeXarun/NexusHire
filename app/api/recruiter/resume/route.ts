import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/db'
import Application from '@/lib/models/Application'
import Job from '@/lib/models/Job'
import { CandidateProfileModel } from '@/lib/models/CandidateProfile'
import { getResumeSignedUrl } from '@/lib/s3'

// GET /api/recruiter/resume?applicationId=xxx
// Returns a short-lived signed S3 URL for the candidate's resume PDF.
// Only the recruiter who owns the job can access it.
export async function GET(req: Request) {
  const session = await auth()
  if (!session || session.user.role !== 'recruiter') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const applicationId = searchParams.get('applicationId')
  if (!applicationId) {
    return NextResponse.json({ error: 'applicationId required' }, { status: 400 })
  }

  await connectDB()

  // Load the application
  const application = await Application.findById(applicationId)
    .select('candidateId jobId')
    .lean() as { candidateId: unknown; jobId: unknown } | null

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  // Verify recruiter owns the job
  const job = await Job.findOne({
    _id: application.jobId,
    recruiterId: session.user.id,
  }).lean()

  if (!job) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch the candidate's profile for their S3 key
  const profile = await CandidateProfileModel.findOne({ userId: application.candidateId })
    .select('resumeS3Key')
    .lean() as { resumeS3Key?: string } | null

  if (!profile?.resumeS3Key) {
    return NextResponse.json({ error: 'No resume uploaded by this candidate' }, { status: 404 })
  }

  // Generate a signed URL valid for 1 hour
  const url = await getResumeSignedUrl(profile.resumeS3Key)

  return NextResponse.json({ url })
}
