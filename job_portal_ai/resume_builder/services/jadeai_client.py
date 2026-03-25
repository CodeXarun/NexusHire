import requests
from django.conf import settings

JADEAI_URL = getattr(settings, 'JADEAI_URL', 'http://localhost:3100')


class JadeAIClient:

    def list_templates(self) -> list:
        try:
            resp = requests.get(f"{JADEAI_URL}/api/templates", timeout=10)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            return {"error": str(e), "note": "JadeAI not running — start it with docker"}

    def export_pdf(self, resume_id: str, template: str = "default") -> bytes:
        resp = requests.get(
            f"{JADEAI_URL}/api/resume/{resume_id}/export",
            params={"format": "pdf", "template": template},
            timeout=60
        )
        resp.raise_for_status()
        return resp.content

    def export_docx(self, resume_id: str) -> bytes:
        resp = requests.get(
            f"{JADEAI_URL}/api/resume/{resume_id}/export",
            params={"format": "docx"},
            timeout=30
        )
        resp.raise_for_status()
        return resp.content