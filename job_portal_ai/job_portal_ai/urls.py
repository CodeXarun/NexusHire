from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/ai/', include('resume_ai.urls')), 
    path('api/builder/', include('resume_builder.urls')), # ✅ keep this
]