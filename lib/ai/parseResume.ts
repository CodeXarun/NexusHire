import { callGroqJSON, MODELS } from '@/lib/groq'
import { PROMPTS } from './prompts'
import { normalizeSkills } from './skillNormalize'

export interface ParsedResume {
  name: string
  email: string
  phone?: string
  location?: string
  headline?: string
  skills: { skill: string; proficiency: string; yearsOfExp?: number }[]
  experience: { title: string; company: string; startDate: string; endDate?: string; current: boolean; description: string }[]
  education: { degree: string; institution: string; year: string; field?: string }[]
  projects: { name: string; description: string; techStack: string[] }[]
  githubUrl?: string
  portfolioUrl?: string
  linkedinUrl?: string
  improvementTips: string[]
}

export async function parseResume(pdfText: string): Promise<ParsedResume> {
  const result = await callGroqJSON<ParsedResume>(MODELS.FAST, PROMPTS.PARSE_RESUME(pdfText))
  result.skills = normalizeSkills(result.skills ?? [])
  return result
}
