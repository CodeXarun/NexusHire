import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IMessage {
  role: 'interviewer' | 'candidate'
  content: string
  score?: number
  feedback?: string
  timestamp: Date
}

export interface IInterviewSession extends Document {
  _id: mongoose.Types.ObjectId
  candidateId: mongoose.Types.ObjectId
  jobId: mongoose.Types.ObjectId
  messages: IMessage[]
  questionCount: number
  feedbackReport?: {
    overallScore: number
    strongestAnswer: string
    weakestAnswer: string
    improvementTips: string[]
    summary: string
  }
  status: 'active' | 'completed'
  completedAt?: Date
  createdAt: Date
}

const InterviewSessionSchema = new Schema<IInterviewSession>({
  candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  messages: [{
    role: { type: String, enum: ['interviewer', 'candidate'] },
    content: String,
    score: Number,
    feedback: String,
    timestamp: { type: Date, default: Date.now },
  }],
  questionCount: { type: Number, default: 0 },
  feedbackReport: {
    overallScore: Number,
    strongestAnswer: String,
    weakestAnswer: String,
    improvementTips: [String],
    summary: String,
  },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  completedAt: Date,
}, { timestamps: true })

export const InterviewSessionModel: Model<IInterviewSession> =
  mongoose.models.InterviewSession ??
  mongoose.model<IInterviewSession>('InterviewSession', InterviewSessionSchema)

export default InterviewSessionModel
