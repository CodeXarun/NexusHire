from django.urls import path
from .views import JobMatchView, UploadResumeView, CompareCandidatesView

urlpatterns = [
    path('upload/', UploadResumeView.as_view(), name='upload_resume'),
    path('compare/', CompareCandidatesView.as_view(), name='compare_candidates'),
    path('match/', JobMatchView.as_view()),
    
]