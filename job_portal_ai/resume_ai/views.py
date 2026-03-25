from rest_framework.views import APIView
from rest_framework.response import Response
from .services.embeddings import get_embedding
from .services.matcher import match_candidates
from .services.embeddings import get_embedding
from .services.feedback import generate_feedback

from .models import Candidate
from .services import parser, scorer

class JobMatchView(APIView):

    def post(self, request):
        job_description = request.data.get("job_description")

        if not job_description:
            return Response({"error": "Job description required"}, status=400)

        job_embedding = get_embedding(job_description)

        candidates = Candidate.objects.all()

        # Step 1: Match candidates
        results = match_candidates(job_embedding, candidates)

        # Step 2: Get top candidate (benchmark)
        top_candidate_obj = candidates.order_by('-ats_score').first()

        # Step 3: Add AI feedback
        for r in results:
            try:
                candidate_obj = candidates.get(id=r["id"])

                feedback = generate_feedback(
                    top_candidate_obj,
                    candidate_obj
                )

                r["feedback"] = feedback

            except Exception as e:
                r["feedback"] = str(e)

        return Response({
            "ranked_candidates": results
        })


class UploadResumeView(APIView):

    def post(self, request):
        file = request.FILES.get('resume')
        name = request.data.get('name')

        if not file:
            return Response({"error": "No file uploaded"}, status=400)

        text = parser.extract_text(file)

        skills = parser.extract_skills(text)
        experience_score = parser.extract_experience(text)
        project_count = parser.extract_projects(text)
        embedding = get_embedding(text)

        scores = scorer.calculate_scores(
            skills,
            experience_score,
            project_count
        )

        candidate = Candidate.objects.create(
            name=name,
            resume_text=text,
            skills=skills,
            embedding=embedding,
            ats_score=scores['ats_score'],
            skill_score=scores['skill_score'],
            experience_score=scores['experience_score'],
            project_score=scores['project_score']
        )

        return Response({
            "skills_detected": skills,
            "projects_detected": project_count,
            "experience_score": experience_score,
            "scores": scores
        })
    
class CompareCandidatesView(APIView):

    def get(self, request):
        candidates = Candidate.objects.all().order_by('-ats_score')

        if not candidates.exists():
            return Response({"error": "No candidates found"}, status=404)

        top_candidate = candidates.first()
        others = candidates[1:]

        result = []

        for c in others:
            result.append({
                "candidate": c.name,
                "gap": round(top_candidate.ats_score - c.ats_score, 2)
            })

        return Response({
            "top_candidate": top_candidate.name,
            "comparisons": result
        })