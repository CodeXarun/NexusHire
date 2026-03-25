import { callGroqJSON, MODELS } from '@/lib/groq'
import { PROMPTS } from './prompts'

export interface MatchScore {
  overall: number
  skillsMatch: number
  experienceMatch: number
  explanation: string
  breakdown: {
    skill: string
    required: boolean
    candidateHas: boolean
    weight: number
    match: 'full' | 'partial' | 'none'
  }[]
}

export async function scoreMatch(
  candidateProfile: object,
  jobEntity: object
): Promise<MatchScore> {
  return callGroqJSON<MatchScore>(MODELS.FAST, PROMPTS.SCORE_MATCH(candidateProfile, jobEntity))
}
