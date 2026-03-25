import OpenAI from 'openai'

let nimClient: OpenAI | null = null

function getNimClient(): OpenAI {
  if (!nimClient) {
    const apiKey = process.env.NVIDIA_NIM_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.warn('NIM API key not configured, embeddings will return zeros')
    }
    nimClient = new OpenAI({
      apiKey: apiKey || 'dummy-key',
      baseURL: 'https://integrate.api.nvidia.com/v1',
    })
  }
  return nimClient
}

const EMBED_MODEL = 'nvidia/llama-nemotron-embed-1b-v2'
const EMBED_DIMS = 768

export async function generateEmbedding(text: string, inputType: 'passage' | 'query' = 'passage'): Promise<number[]> {
  try {
    const response = await getNimClient().embeddings.create({
      model: EMBED_MODEL,
      input: text.slice(0, 8000), // NIM has input length limits
      // @ts-expect-error: NIM requires input_type for asymmetric models
      input_type: inputType,
    })
    return response.data[0].embedding
  } catch (err) {
    console.error('NIM embedding error, falling back to zeros:', err)
    // Fallback: return zero vector (matching will degrade but app won't crash)
    return new Array(EMBED_DIMS).fill(0)
  }
}

// Convenience wrapper for search queries (uses 'query' input_type)
export function generateQueryEmbedding(text: string): Promise<number[]> {
  return generateEmbedding(text, 'query')
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

export { EMBED_DIMS }
