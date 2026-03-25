from django.urls import path
from . import views

urlpatterns = [

    # ── Resume CRUD ──────────────────────────────────────────
    path('resumes/',              views.resume_list,   name='resume-list'),
    path('resumes/<int:pk>/',     views.resume_detail, name='resume-detail'),

    # ── Sub-resources ────────────────────────────────────────
    path('resumes/<int:resume_pk>/work/',      views.add_work_experience, name='add-work'),
    path('work/<int:pk>/',                     views.work_experience_detail, name='work-detail'),
    path('resumes/<int:resume_pk>/education/', views.add_education,       name='add-edu'),
    path('resumes/<int:resume_pk>/projects/',  views.add_project,         name='add-project'),
    path('resumes/<int:resume_pk>/skills/',    views.add_skill,           name='add-skill'),

    # ── AI ───────────────────────────────────────────────────
    path('ai/improve-bullet/',                       views.ai_improve_bullet,    name='improve-bullet'),
    path('ai/categorize-skills/',                    views.ai_categorize_skills, name='categorize-skills'),
    path('ai/resumes/<int:resume_pk>/jd-match/',     views.ai_jd_match,          name='jd-match'),
    path('ai/resumes/<int:resume_pk>/summary/',      views.ai_generate_summary,  name='gen-summary'),

    # ── Upload & Parse ───────────────────────────────────────
    path('resumes/upload/preview/',  views.upload_and_parse,        name='upload-preview'),
    path('resumes/upload/save/',     views.upload_parse_and_save,   name='upload-save'),

    # ── Version & Export ─────────────────────────────────────
    path('resumes/<int:resume_pk>/versions/', views.version_history, name='versions'),
    path('resumes/<int:resume_pk>/export/json/', views.export_json,  name='export-json'),
]