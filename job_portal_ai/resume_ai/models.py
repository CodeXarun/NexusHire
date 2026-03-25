from django.db import models

class Candidate(models.Model):
    name = models.CharField(max_length=255)
    resume_text = models.TextField()

    skills = models.JSONField(null=True, blank=True)
    embedding = models.JSONField(null=True, blank=True)

    ats_score = models.FloatField(null=True, blank=True)
    skill_score = models.FloatField(null=True, blank=True)
    experience_score = models.FloatField(null=True, blank=True)
    project_score = models.FloatField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)