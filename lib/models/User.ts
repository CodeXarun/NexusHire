import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId
  email: string
  name: string
  passwordHash?: string
  image?: string
  role: 'candidate' | 'recruiter'
  provider: 'credentials' | 'google' | 'firebase'
  createdAt: Date
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true },
  name: { type: String, required: true },
  passwordHash: { type: String },
  image: { type: String },
  role: { type: String, enum: ['candidate', 'recruiter'], required: true },
  provider: { type: String, enum: ['credentials', 'google', 'firebase'], default: 'credentials' },
}, { timestamps: true })

export const UserModel: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>('User', UserSchema)

export default UserModel
