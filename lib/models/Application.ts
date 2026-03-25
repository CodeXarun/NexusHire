import mongoose, { Schema, Document, Model } from 'mongoose'

export type ApplicationStage = 'applied' | 'under_review' | 'shortlisted' | 'interview' | 'decision' | 'outcome'
export type ApplicationOutcome = 'hired' | 'rejected' | null

export interface ISkillBreakdown {
  skill: string
  required: boolean
  candidateHas: boolean
  weight: number
  match: 'full' | 'partial' | 'none'
}

export interface ISkillGapPath {
  skill: string
  resources: { title: string; url: string; type: string }[]
  weeklyPlan: string[]
}

export interface IApplication extends Document {
  _id: mongoose.Types.ObjectId
  candidateId: mongoose.Types.ObjectId
  jobId: mongoose.Types.ObjectId
  stage: ApplicationStage
  outcome: ApplicationOutcome
  matchScore: {
    overall: number
    skillsMatch: number
    experienceMatch: number
    explanation: string
  }
  breakdown: ISkillBreakdown[]
  percentileRank: number
  stageHistory: { stage: string; timestamp: Date; note?: string }[]
  recruiterNotes: string
  skillGapPath: ISkillGapPath[]
  appliedAt: Date
  updatedAt: Date
}

const ApplicationSchema = new Schema<IApplication>({
  candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  stage: {
    type: String,
    enum: ['applied', 'under_review', 'shortlisted', 'interview', 'decision', 'outcome'],
    default: 'applied',
  },
  outcome: { type: String, enum: ['hired', 'rejected', null], default: null },
  matchScore: {
    overall: { type: Number, default: 0 },
    skillsMatch: { type: Number, default: 0 },
    experienceMatch: { type: Number, default: 0 },
    explanation: { type: String, default: '' },
  },
  breakdown: [{
    skill: String,
    required: Boolean,
    candidateHas: Boolean,
    weight: Number,
    match: { type: String, enum: ['full', 'partial', 'none'] },
  }],
  percentileRank: { type: Number, default: 50 },
  stageHistory: [{ stage: String, timestamp: { type: Date, default: Date.now }, note: String }],
  recruiterNotes: { type: String, default: '' },
  skillGapPath: [{
    skill: String,
    resources: [{ title: String, url: String, type: String }],
    weeklyPlan: [String],
  }],
  appliedAt: { type: Date, default: Date.now },
}, { timestamps: true })

ApplicationSchema.index({ candidateId: 1 })
ApplicationSchema.index({ jobId: 1 })
ApplicationSchema.index({ candidateId: 1, jobId: 1 }, { unique: true })

export const ApplicationModel: Model<IApplication> =
  mongoose.models.Application ??
  mongoose.model<IApplication>('Application', ApplicationSchema)

export default ApplicationModel
