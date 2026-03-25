from django.db import models


class ResumeProfile(models.Model):
    # Basic info
    full_name   = models.CharField(max_length=255)
    email       = models.EmailField()
    phone       = models.CharField(max_length=30, blank=True)
    linkedin    = models.URLField(blank=True)
    github      = models.URLField(blank=True)
    portfolio   = models.URLField(blank=True)
    summary     = models.TextField(blank=True)
    target_role = models.CharField(max_length=255, blank=True)

    # Linked to your existing Candidate optionally
    candidate_id = models.IntegerField(null=True, blank=True)  # soft ref, no FK

    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.full_name} — {self.target_role}"


class WorkExperience(models.Model):
    resume      = models.ForeignKey(ResumeProfile, on_delete=models.CASCADE,
                                    related_name='work_experiences')
    company     = models.CharField(max_length=255)
    role        = models.CharField(max_length=255)
    start_date  = models.CharField(max_length=30)
    end_date    = models.CharField(max_length=30, blank=True, default='Present')
    bullets     = models.JSONField(default=list)   # ["Led team...", "Built API..."]
    order       = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']


class Education(models.Model):
    resume      = models.ForeignKey(ResumeProfile, on_delete=models.CASCADE,
                                    related_name='education')
    institution = models.CharField(max_length=255)
    degree      = models.CharField(max_length=255)
    cgpa        = models.CharField(max_length=10, blank=True)
    start_year  = models.CharField(max_length=10)
    end_year    = models.CharField(max_length=10)
    order       = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']


class Project(models.Model):
    resume      = models.ForeignKey(ResumeProfile, on_delete=models.CASCADE,
                                    related_name='projects')
    title       = models.CharField(max_length=255)
    tech_stack  = models.CharField(max_length=300)
    description = models.TextField()
    impact      = models.TextField(blank=True)
    link        = models.URLField(blank=True)
    order       = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']


class Skill(models.Model):
    CATEGORY_CHOICES = [
        ('language',  'Languages'),
        ('framework', 'Frameworks'),
        ('tool',      'Tools'),
        ('soft',      'Soft Skills'),
        ('other',     'Other'),
    ]
    resume    = models.ForeignKey(ResumeProfile, on_delete=models.CASCADE,
                                  related_name='skills')
    name      = models.CharField(max_length=100)
    category  = models.CharField(max_length=20, choices=CATEGORY_CHOICES,
                                 default='other')


class Certification(models.Model):
    resume  = models.ForeignKey(ResumeProfile, on_delete=models.CASCADE,
                                related_name='certifications')
    title   = models.CharField(max_length=255)
    issuer  = models.CharField(max_length=255)
    year    = models.CharField(max_length=10)


class ResumeVersion(models.Model):
    """Auto-snapshot every time PDF is exported."""
    resume     = models.ForeignKey(ResumeProfile, on_delete=models.CASCADE,
                                   related_name='versions')
    label      = models.CharField(max_length=100)      # "v1", "tailored for Google"
    snapshot   = models.JSONField()                     # full resume at that moment
    template   = models.CharField(max_length=50, default='jake')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class ATSResult(models.Model):
    """Stores JD match results so you don't re-call AI every time."""
    resume          = models.ForeignKey(ResumeProfile, on_delete=models.CASCADE,
                                        related_name='ats_results')
    job_description = models.TextField()
    ats_score       = models.FloatField()
    matched_keywords = models.JSONField(default=list)
    missing_keywords = models.JSONField(default=list)
    feedback        = models.TextField(blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']