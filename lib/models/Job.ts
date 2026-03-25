import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IRequiredSkill {
  skill: string
  weight: 1 | 2 | 3
  type: 'technical' | 'soft' | 'domain'
}

export interface IJob extends Document {
  _id: mongoose.Types.ObjectId
  recruiterId: mongoose.Types.ObjectId
  companyName?: string
  title: string
  description: string
  requiredSkills: IRequiredSkill[]
  experienceRange: { min: number; max: number }
  roleLevel: 'junior' | 'mid' | 'senior' | 'lead' | 'principal'
  cultureTags: string[]
  salaryRange: { min: number; max: number; currency: string }
  location: string
  workType: 'remote' | 'hybrid' | 'onsite'
  embedding: number[]
  status: 'draft' | 'active' | 'paused' | 'closed'
  applicantCount: number
  avgMatchScore: number
  createdAt: Date
  updatedAt: Date
}

const JobSchema = new Schema<IJob>({
  recruiterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  companyName: { type: String, default: '' },
  title: { type: String, required: true },
  description: { type: String, required: true },
  requiredSkills: [{
    skill: String,
    weight: { type: Number, enum: [1, 2, 3], default: 2 },
    type: { type: String, enum: ['technical', 'soft', 'domain', 'tool'], default: 'technical' },
  }],
  experienceRange: { min: { type: Number, default: 0 }, max: { type: Number, default: 10 } },
  roleLevel: { type: String, enum: ['junior', 'mid', 'senior', 'lead', 'principal'], default: 'mid' },
  cultureTags: [String],
  salaryRange: {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
  },
  location: { type: String, default: '' },
  workType: { type: String, enum: ['remote', 'hybrid', 'onsite'], default: 'hybrid' },
  embedding: { type: [Number], default: [] },
  status: { type: String, enum: ['draft', 'active', 'paused', 'closed'], default: 'active' },
  applicantCount: { type: Number, default: 0 },
  avgMatchScore: { type: Number, default: 0 },
}, { timestamps: true })

JobSchema.index({ status: 1, createdAt: -1 })

export const JobModel: Model<IJob> =
  mongoose.models.Job ?? mongoose.model<IJob>('Job', JobSchema)

export default JobModel
