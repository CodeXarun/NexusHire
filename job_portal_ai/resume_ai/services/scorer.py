def calculate_scores(skills, experience_score, project_count):

    # Skill score
    skill_score = len(skills) * 8

    # Experience score (already processed)
    exp_score = min(experience_score, 20)

    # Project score
    project_score = min(project_count * 5, 25)

    # Final ATS Score
    ats_score = (
        skill_score * 0.4 +
        exp_score * 0.3 +
        project_score * 0.3
    )

    return {
        "skill_score": skill_score,
        "experience_score": exp_score,
        "project_score": project_score,
        "ats_score": round(ats_score, 2)
    }