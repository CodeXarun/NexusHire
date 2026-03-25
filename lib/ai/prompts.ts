export const PROMPTS = {
  PARSE_RESUME: (text: string) => `
Parse the following resume text and extract structured information.
Return ONLY valid JSON, no markdown, no explanation.

Resume text:
${text.slice(0, 6000)}

Return this exact JSON structure:
{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "phone number or null",
  "location": "city, country or null",
  "headline": "professional headline (infer from experience)",
  "skills": [
    { "skill": "React", "proficiency": "advanced", "yearsOfExp": 3 }
  ],
  "experience": [
    { "title": "Job Title", "company": "Company", "startDate": "Jan 2022", "endDate": "Present", "current": true, "description": "brief description" }
  ],
  "education": [
    { "degree": "B.Tech Computer Science", "institution": "IIT Bombay", "year": "2022", "field": "Computer Science" }
  ],
  "projects": [
    { "name": "Project", "description": "description", "techStack": ["React", "Node.js"] }
  ],
  "githubUrl": null,
  "portfolioUrl": null,
  "linkedinUrl": null,
  "improvementTips": [
    "Add quantified achievements to your work experience",
    "Include links to your GitHub or portfolio projects",
    "Expand descriptions to highlight impact and scope"
  ]
}`,

  DECOMPOSE_JD: (jdText: string) => `
Analyze this job description and decompose it into a structured entity.
Return ONLY valid JSON, no markdown, no explanation.

Job Description:
${jdText.slice(0, 4000)}

Return this exact JSON structure:
{
  "title": "normalized job title",
  "requiredSkills": [
    { "skill": "Node.js", "weight": 3, "type": "technical" },
    { "skill": "Communication", "weight": 1, "type": "soft" }
  ],
  "experienceRange": { "min": 2, "max": 5 },
  "roleLevel": "mid",
  "cultureTags": ["remote-first", "fast-paced"],
  "salaryRange": { "min": 0, "max": 0, "currency": "INR" },
  "location": "Bangalore, India or Remote",
  "workType": "hybrid"
}

Rules:
- weight 3 = must-have, weight 2 = important, weight 1 = nice-to-have
- roleLevel must be one of: junior, mid, senior, lead, principal
- Normalize skill names (ReactJS → React, NodeJS → Node.js)
- workType must be: remote, hybrid, or onsite`,

  SCORE_MATCH: (candidateProfile: object, jobEntity: object) => `
Score this candidate's compatibility with the job.
Return ONLY valid JSON, no markdown, no explanation.

Candidate Profile:
${JSON.stringify(candidateProfile, null, 2).slice(0, 2000)}

Job Requirements:
${JSON.stringify(jobEntity, null, 2).slice(0, 2000)}

Return this exact JSON structure:
{
  "overall": 78,
  "skillsMatch": 85,
  "experienceMatch": 70,
  "explanation": "2-3 sentence explanation of why this score. Be specific about what they have and what they're missing.",
  "breakdown": [
    { "skill": "Node.js", "required": true, "candidateHas": true, "weight": 3, "match": "full" },
    { "skill": "Kubernetes", "required": true, "candidateHas": false, "weight": 2, "match": "none" }
  ]
}

Rules:
- overall is a weighted average: skillsMatch*0.6 + experienceMatch*0.4
- For each required skill in the job, include it in breakdown
- match: "full" = candidate clearly has it, "partial" = adjacent/related skill, "none" = missing`,

  INTERVIEW_START: (jobTitle: string, skills: string[]) => `
You are a senior technical interviewer for a ${jobTitle} position.
Required skills for this role: ${skills.slice(0, 8).join(', ')}.
Ask your first interview question. Make it specific to the role and challenging but fair.
Ask ONE question only. No preamble or introduction.`,

  INTERVIEW_RESPOND: (jobTitle: string, history: Array<{role: string, content: string}>, newAnswer: string) => `
You are a senior technical interviewer for a ${jobTitle} position.

Conversation history:
${history.map(m => `${m.role === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${m.content}`).join('\n')}
Candidate: ${newAnswer}

First, evaluate the candidate's latest answer, then ask the next question.
Return ONLY valid JSON:
{
  "evaluation": {
    "score": 7,
    "feedback": "Good understanding of concepts but missed mention of X"
  },
  "nextQuestion": "Your next question here, or null if this was the 5th question",
  "isComplete": false
}

isComplete should be true only after the 5th question has been answered.`,

  INTERVIEW_REPORT: (jobTitle: string, messages: Array<{role: string, content: string, score?: number}>) => `
Generate a feedback report for this interview session for a ${jobTitle} role.
Return ONLY valid JSON, no markdown.

Interview transcript:
${messages.map(m => `${m.role}: ${m.content} ${m.score ? `[Score: ${m.score}/10]` : ''}`).join('\n').slice(0, 3000)}

Return:
{
  "overallScore": 72,
  "strongestAnswer": "The answer about X demonstrated deep understanding because...",
  "weakestAnswer": "The answer about Y was weak because...",
  "improvementTips": [
    "Specific tip 1",
    "Specific tip 2",
    "Specific tip 3"
  ],
  "summary": "2-3 sentence overall assessment"
}`,

  SKILL_GAP_PATH: (skill: string) => `
Generate a 2-3 week learning path for: ${skill}
Use only FREE resources. Include real, specific URLs that actually exist.
Return ONLY valid JSON:
{
  "skill": "${skill}",
  "weeklyPlan": [
    "Week 1: Fundamentals — core concepts",
    "Week 2: Practice — build projects",
    "Week 3: Advanced — edge cases"
  ],
  "resources": [
    { "title": "Exact resource title", "url": "https://actual-url.com/path", "type": "video" },
    { "title": "Exact resource title", "url": "https://actual-url.com/path", "type": "article" },
    { "title": "Exact resource title", "url": "https://actual-url.com/path", "type": "course" },
    { "title": "Exact resource title", "url": "https://actual-url.com/path", "type": "docs" }
  ]
}

Rules:
- type must be one of: video, article, course, docs, practice
- Prefer: YouTube tutorials, official docs, MDN, freeCodeCamp.org, roadmap.sh, dev.to, Coursera free audit
- Use real known URLs (e.g. https://www.youtube.com/..., https://developer.mozilla.org/..., https://www.freecodecamp.org/...)
- Include 3-5 resources total, mix of types
- Do NOT invent fake URLs`,

  EXPLAIN_MATCH: (score: number, breakdown: object[], candidateName: string, jobTitle: string) => `
Explain in 3 clear sentences why ${candidateName} scored ${score}% for the ${jobTitle} role.
Skill breakdown: ${JSON.stringify(breakdown).slice(0, 500)}
Be specific. Mention exact skills that matched and exact skills that are missing.
Return only the explanation text, no JSON.`,

  ENHANCE_ACHIEVEMENTS: (items: string[]) => `
Rewrite these achievement bullet points to be more impactful, specific, and quantified.
Return ONLY valid JSON, no markdown.

Achievements:
${items.map((a, i) => `${i + 1}. ${a}`).join('\n')}

Return:
{
  "enhanced": [
    "Enhanced achievement 1",
    "Enhanced achievement 2"
  ]
}

Rules:
- Preserve all factual information — do NOT invent numbers, ranks, or details not present in the original
- Add context only if it makes the claim clearer (e.g. "global platform" after "TryHackMe")
- Start with strong action verbs: Ranked, Achieved, Won, Placed, Secured, etc.
- Keep each item under 25 words
- Bold keywords are fine — output plain text only`,

  ENHANCE_PROJECT_BULLETS: (projectName: string, bullets: string[], techStack: string) => `
Rewrite these project description bullet points to be more impactful for a resume.
Return ONLY valid JSON, no markdown.

Project: ${projectName}
Tech Stack: ${techStack}
Bullets:
${bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}

Return:
{
  "enhanced": [
    "Improved bullet 1",
    "Improved bullet 2"
  ]
}

Rules:
- Start each bullet with a strong past-tense action verb (Developed, Built, Designed, Implemented, etc.)
- Mention specific technical components or outcomes where known
- Keep each under 25 words
- Do NOT add features or details not present in the original`,

  ATS_CHECK: (resumeText: string, jobDescription: string) => `
Analyze this candidate's profile against the job description and calculate an ATS compatibility score.
Return ONLY valid JSON, no markdown, no explanation.

Candidate Profile:
${resumeText.slice(0, 2000)}

Job Description:
${jobDescription.slice(0, 2000)}

Return this exact JSON structure:
{
  "atsScore": 0, // REPLACE 0 with the computed score (0-100) based on match
  "matchedKeywords": ["React", "Node.js", "MongoDB"],
  "missingKeywords": ["Docker", "Kubernetes", "AWS"],
  "feedback": "3-4 sentence specific, actionable feedback on how to close the gap for this exact JD."
}

Rules:
- atsScore: An integer from 0 to 100 representing the exact compatibility match. DO NOT output 0 unless it's a 0% match. DO NOT output 72 or 85 unless it is exactly that match. Compute this properly!
- matchedKeywords: important skills/keywords from the JD the candidate clearly has (5-10 items max)
- missingKeywords: important skills/keywords from the JD the candidate lacks (5-10 items max)
- feedback must be specific to this candidate and this JD — no generic advice`,

  IMPROVE_BULLET: (bullet: string, targetRole: string) => `
Rewrite this resume bullet point using strong action verbs and STAR format for a ${targetRole} role.

Original: "${bullet}"

Return ONLY valid JSON:
{
  "improved": [
    "Strong version 1 with quantified impact",
    "Strong version 2 with different emphasis",
    "Concise version 3"
  ],
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "feedback": "One sentence on what was weak in the original."
}

Rules:
- Each improved option is ONE bullet (no sub-points), under 30 words
- Start with a strong past-tense action verb (Built, Reduced, Led, Designed, Automated, etc.)
- Include measurable impact where possible (%, $, time saved, scale)
- keywords are ATS-relevant terms added/highlighted by the rewrite`,

  GENERATE_SUMMARY: (profile: object) => `
Generate a concise professional resume summary for this candidate.
Return ONLY valid JSON, no markdown.

Profile:
${JSON.stringify(profile, null, 2).slice(0, 1500)}

Return:
{
  "summary": "3-sentence professional summary"
}

Rules:
- Sentence 1: Role/title + years of experience + top specialization
- Sentence 2: 2-3 key technical strengths + specific domain/achievement
- Sentence 3: Career goal or unique value proposition
- Write in third-person omitting subject ("Experienced engineer..." not "I am...")
- Be specific, avoid "passionate", "hardworking", "results-driven"
- Max 65 words total`,

  CATEGORIZE_SKILLS: (skills: string[]) => `
Categorize these skills into four groups.
Return ONLY valid JSON, no markdown.

Skills: ${JSON.stringify(skills)}

Return:
{
  "languages": ["Python", "JavaScript"],
  "frameworks": ["React", "Django"],
  "tools": ["Docker", "Git", "AWS", "PostgreSQL"],
  "soft": ["Leadership", "Communication"]
}

Rules:
- languages: programming/scripting/markup languages (Python, JS, SQL, HTML, CSS, Go, etc.)
- frameworks: libraries, frameworks, runtime platforms (React, Django, Spring, Next.js, etc.)
- tools: DevOps, cloud, databases, IDEs, software tools (Docker, AWS, MongoDB, Figma, etc.)
- soft: interpersonal, business, management skills
- Include EVERY input skill in exactly ONE category — do NOT omit any
- Do NOT add skills that were not in the input`,

  CONTEXTUAL_REJECTION: (params: {
    jobTitle: string
    jobDescription: string
    requiredSkills: Array<{ skill: string; weight: number; type: string }>
    candidateSkills: string[]
    candidateMatchScore: number
    recruiterNotes: string
    recruiterStageNotes: string[]
    hiredCandidatesSkills: Array<{ name: string; skills: string[] }>
    missingSkillsFromJD: string[]
  }) => `
You are an AI career coach providing honest, constructive, and specific feedback to a rejected job candidate.

Job: "${params.jobTitle}"
Job Description (excerpt): ${params.jobDescription.slice(0, 800)}

Required Skills (weight 3 = critical, 2 = important, 1 = nice-to-have):
${params.requiredSkills.map(s => `  - ${s.skill} (weight: ${s.weight}, type: ${s.type})`).join('\n')}

Candidate's Current Skills: ${params.candidateSkills.join(', ') || 'Not provided'}
Candidate's Match Score: ${params.candidateMatchScore}%
Skills Missing from JD: ${params.missingSkillsFromJD.join(', ') || 'None identified'}

Recruiter's Personal Notes (private feedback shared for your growth):
"${params.recruiterNotes || 'No specific notes provided.'}"

Recruiter's Stage Comments (what was said at each review step):
${params.recruiterStageNotes.length > 0 ? params.recruiterStageNotes.map((n, i) => `  ${i + 1}. "${n}"`).join('\n') : '  No stage comments.'}

${params.hiredCandidatesSkills.length > 0 ? `Skills of candidates who were selected for this role:
${params.hiredCandidatesSkills.map(c => `  - ${c.name}: ${c.skills.join(', ')}`).join('\n')}` : ''}

Based on ALL of the above (recruiter feedback, JD requirements, comparison to selected candidates), generate a comprehensive, honest, and actionable rejection analysis.

Return ONLY valid JSON:
{
  "summary": "2-3 sentence honest summary of why the candidate was rejected, referencing the recruiter's feedback and JD gaps specifically.",
  "recruiterFeedbackInsight": "A 1-2 sentence interpretation of what the recruiter's notes reveal about what they were really looking for, written for the candidate.",
  "topGaps": [
    {
      "skill": "Skill name",
      "gapType": "missing | weak | experience_level",
      "reason": "Specific reason this gap hurt the application, referencing JD weight or recruiter notes",
      "priority": "high | medium | low"
    }
  ],
  "comparedToSelected": ${params.hiredCandidatesSkills.length > 0 ? `"1-2 sentences comparing what the selected candidates had that this candidate lacked."` : `null`},
  "actionableSteps": [
    "Specific, concrete action step 1 (not generic, tied to this job's requirements)",
    "Specific, concrete action step 2",
    "Specific, concrete action step 3"
  ],
  "encouragement": "1 sentence of genuine, specific encouragement referencing their strengths."
}

Rules:
- Be honest but constructive — this is meant to help the candidate grow
- Make actionableSteps SPECIFIC to this job and recruiter feedback, not generic advice
- If recruiter notes mention something specific (soft skill, attitude, experience level), address it directly
- topGaps must have at least 2 items and at most 5`,
}
