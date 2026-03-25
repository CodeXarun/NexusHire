import json
import os
from groq import Groq
from django.conf import settings

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL  = "openai/gpt-oss-20b"


def improve_bullet(bullet: str, target_role: str) -> dict:
    """
    Input:  weak bullet + role
    Output: { improved: [...3 options], keywords: [...], feedback: "..." }
    """
    prompt = f"""You are a FAANG senior recruiter and career coach.
Candidate is targeting: {target_role}
Weak bullet: "{bullet}"

Rewrite using STAR format (Action Verb + Task + Metric/Result).
Return ONLY valid JSON:
{{
  "improved": ["bullet 1", "bullet 2", "bullet 3"],
  "keywords": ["kw1", "kw2", "kw3", "kw4", "kw5"],
  "feedback": "one sentence on what was weak"
}}"""

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    return json.loads(resp.choices[0].message.content)


def categorize_skills(skills: list) -> dict:
    """
    Input:  ["Python", "React", "Leadership", "Docker"]
    Output: { languages: [], frameworks: [], tools: [], soft_skills: [] }
    """
    prompt = f"""Categorize these skills strictly into four groups.
Skills: {skills}
Return ONLY valid JSON:
{{
  "languages":  [],
  "frameworks": [],
  "tools":      [],
  "soft_skills":[]
}}"""

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    return json.loads(resp.choices[0].message.content)


def jd_match_analysis(resume_text: str, job_description: str) -> dict:
    """
    Input:  full resume text + JD
    Output: { ats_score: 0-100, matched_keywords: [], missing_keywords: [], feedback: "" }
    """
    prompt = f"""You are an ATS system and recruiter.
Analyze how well this resume matches the job description.

Job Description:
{job_description[:2000]}

Resume:
{resume_text[:2000]}

Return ONLY valid JSON:
{{
  "ats_score": 0-100,
  "matched_keywords": ["kw1", "kw2"],
  "missing_keywords": ["kw3", "kw4"],
  "feedback": "2-3 sentence actionable feedback"
}}"""

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    return json.loads(resp.choices[0].message.content)


def parse_resume_text(raw_text: str, target_role: str = "") -> dict:
    """
    Input:  raw text from uploaded PDF/DOCX
    Output: structured resume JSON matching our models
    """
    prompt = f"""Extract this resume into structured JSON.
Target role hint: {target_role}

Resume text:
{raw_text[:4000]}

Return ONLY valid JSON with this exact structure:
{{
  "full_name": "",
  "email": "",
  "phone": "",
  "summary": "",
  "target_role": "",
  "work_experiences": [
    {{"company":"","role":"","start_date":"","end_date":"","bullets":[]}}
  ],
  "education": [
    {{"institution":"","degree":"","cgpa":"","start_year":"","end_year":""}}
  ],
  "skills": [
    {{"name":"","category":""}}
  ],
  "projects": [
    {{"title":"","tech_stack":"","description":"","impact":"","link":""}}
  ],
  "certifications": [
    {{"title":"","issuer":"","year":""}}
  ]
}}"""

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"}
    )
    return json.loads(resp.choices[0].message.content)


def generate_summary(profile: dict, target_role: str) -> str:
    """Auto-generate a professional summary from profile data."""
    prompt = f"""Write a 3-sentence professional resume summary.
Target role: {target_role}
Skills: {profile.get('skills', [])}
Experience: {profile.get('work_experiences', [])}
Return ONLY the summary text, no JSON."""

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}]
    )
    return resp.choices[0].message.content.strip()