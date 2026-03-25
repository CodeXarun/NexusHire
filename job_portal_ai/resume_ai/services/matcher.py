from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

def match_candidates(job_embedding, candidates):

    results = []

    for c in candidates:
        if c.embedding:
            score = cosine_similarity(
                [job_embedding],
                [c.embedding]
            )[0][0]

            results.append({
                "id": c.id,  # ✅ ADD THIS
                "name": c.name,
                "match_score": float(score),
                "ats_score": c.ats_score
            })

    # Sort by match score
    results.sort(key=lambda x: x['match_score'], reverse=True)

    return results