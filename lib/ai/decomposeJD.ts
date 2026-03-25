import { callGroqJSON, MODELS } from '@/lib/groq'
import { PROMPTS } from './prompts'
import { normalizeSkills } from './skillNormalize'

export interface DecomposedJD {
  title: string
  requiredSkills: { skill: string; weight: 1 | 2 | 3; type: 'technical' | 'soft' | 'domain' }[]
  experienceRange: { min: number; max: number }
  roleLevel: 'junior' | 'mid' | 'senior' | 'lead' | 'principal'
  cultureTags: string[]
  salaryRange: { min: number; max: number; currency: string }
  location: string
  workType: 'remote' | 'hybrid' | 'onsite'
}

export async function decomposeJD(jdText: string): Promise<DecomposedJD> {
  const result = await callGroqJSON<DecomposedJD>(MODELS.FAST, PROMPTS.DECOMPOSE_JD(jdText))
  result.requiredSkills = normalizeSkills(result.requiredSkills ?? [])
  return result
}
