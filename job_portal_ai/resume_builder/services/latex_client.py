import requests
from django.conf import settings

LATEX_URL = getattr(settings, 'LATEX_SERVICE_URL', 'http://localhost:8500')


class LaTeXClient:

    def generate_pdf(self, resume_data: dict, template: str = "jake") -> bytes:
        resp = requests.post(
            f"{LATEX_URL}/generate-pdf",
            json={"resume": resume_data, "template": template},
            timeout=60
        )
        resp.raise_for_status()
        return resp.content

    def ats_score(self, resume_text: str, job_description: str) -> dict:
        resp = requests.post(
            f"{LATEX_URL}/ats-score",
            json={"resume_text": resume_text, "job_description": job_description},
            timeout=20
        )
        resp.raise_for_status()
        return resp.json()