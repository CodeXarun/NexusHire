import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ISkill {
  skill: string
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  yearsOfExp?: number
}

export interface IExperience {
  title: string
  company: string
  startDate: string
  endDate?: string
  current: boolean
  description: string  // newline-separated bullet points
}

export interface IEducation {
  degree: string
  institution: string
  year: string
  field?: string
  cgpa?: string  // e.g. "8.19/10" or "70.02%"
}

export interface IProject {
  name: string
  description: string  // newline-separated bullet points
  techStack: string[]
  url?: string
}

export interface ICertification {
  title: string
  url?: string
}

export interface ISkillGroup {
  category: string   // e.g. "Programming Languages"
  skills: string[]   // e.g. ["Java", "C++", "Python"]
}

export interface ICandidateProfile extends Document {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  headline: string
  bio?: string
  location: string
  phone?: string
  githubUrl?: string
  portfolioUrl?: string
  linkedinUrl?: string
  tryhackmeUrl?: string
  skills: ISkill[]
  skillGroups: ISkillGroup[]   // for resume PDF display
  experience: IExperience[]
  education: IEducation[]
  projects: IProject[]
  certifications: ICertification[]
  achievements: string[]
  resumeS3Key?: string
  resumeText?: string
  embedding: number[]
  profileStrength: number
  resumeImprovementTips: string[]
  recentInteractionSkills: string[]
  createdAt: Date
  updatedAt: Date
}

const CandidateProfileSchema = new Schema<ICandidateProfile>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  headline: { type: String, default: '' },
  bio: { type: String, default: '' },
  location: { type: String, default: '' },
  phone: { type: String, default: '' },
  githubUrl: String,
  portfolioUrl: String,
  linkedinUrl: String,
  tryhackmeUrl: String,
  skills: [{
    skill: String,
    proficiency: { type: String, enum: ['beginner', 'intermediate', 'advanced', 'expert'] },
    yearsOfExp: Number,
  }],
  skillGroups: [{
    category: String,
    skills: [String],
  }],
  experience: [{
    title: String, company: String, startDate: String, endDate: String,
    current: Boolean, description: String,
  }],
  education: [{ degree: String, institution: String, year: String, field: String, cgpa: String }],
  projects: [{ name: String, description: String, techStack: [String], url: String }],
  certifications: [{ title: String, url: String }],
  achievements: [String],
  resumeS3Key: String,
  resumeText: String,
  embedding: { type: [Number], default: [] },
  profileStrength: { type: Number, default: 0 },
  resumeImprovementTips: [String],
  recentInteractionSkills: { type: [String], default: [] },
}, { timestamps: true })

CandidateProfileSchema.index({ embedding: '2dsphere' })

export const CandidateProfileModel: Model<ICandidateProfile> =
  mongoose.models.CandidateProfile ??
  mongoose.model<ICandidateProfile>('CandidateProfile', CandidateProfileSchema)

export default CandidateProfileModel
