import Groq from 'groq-sdk'

const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export const MODELS = {
  FAST: 'llama-3.1-8b-instant',      // resume parsing, JD decomp, scoring
  SMART: 'llama-3.3-70b-versatile',  // interview, explainability, learning paths
} as const

async function callGroq(
  model: string,
  prompt: string,
  systemPrompt?: string,
  retries = 1
): Promise<string> {
  const messages: Groq.Chat.ChatCompletionMessageParam[] = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: prompt })

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await groqClient.chat.completions.create({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 2048,
      })
      return res.choices[0]?.message?.content ?? ''
    } catch (err: any) {
      if (attempt === retries) throw err
      await new Promise(r => setTimeout(r, 500))
    }
  }
  return ''
}

function extractJSON(text: string): unknown {
  // Strip markdown code fences
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    // Try to find JSON object/array in text
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/m)
    if (match) return JSON.parse(match[1])
    throw new Error(`Could not parse JSON from Groq response: ${cleaned.slice(0, 200)}`)
  }
}

export async function callGroqJSON<T = unknown>(
  model: string,
  prompt: string,
  systemPrompt?: string
): Promise<T> {
  const text = await callGroq(model, prompt, systemPrompt)
  return extractJSON(text) as T
}

export { callGroq }
export default groqClient
