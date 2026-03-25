import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ICompanyProfile extends Document {
  userId: mongoose.Types.ObjectId
  companyName: string
  industry: string
  size: string
  website?: string
  description?: string
  logoUrl?: string
}

const CompanyProfileSchema = new Schema<ICompanyProfile>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  companyName: { type: String, required: true },
  industry: { type: String, default: '' },
  size: { type: String, default: '' },
  website: String,
  description: String,
  logoUrl: String,
}, { timestamps: true })

export const CompanyProfileModel: Model<ICompanyProfile> =
  mongoose.models.CompanyProfile ??
  mongoose.model<ICompanyProfile>('CompanyProfile', CompanyProfileSchema)

export default CompanyProfileModel
