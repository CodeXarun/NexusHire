import os
from groq import Groq

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def generate_feedback(top_candidate, current_candidate):

    prompt = f"""
Compare two candidates and give improvement suggestions.

Top Candidate:
Skills: {top_candidate.skill_score}
Experience: {top_candidate.experience_score}
Projects: {top_candidate.project_score}

Current Candidate:
Skills: {current_candidate.skill_score}
Experience: {current_candidate.experience_score}
Projects: {current_candidate.project_score}

Give:
- Missing skills
- Experience gap
- Project improvements
- Final suggestion
"""

    try:
        response = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": "You are a hiring expert."},
                {"role": "user", "content": prompt}
            ]
        )

        return response.choices[0].message.content

    except Exception as e:
        return {"error": str(e)}