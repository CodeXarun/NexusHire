import pdfplumber
import docx
import re


# -------------------------------
# TEXT EXTRACTION
# -------------------------------

def extract_text(file):
    filename = file.name.lower()

    if filename.endswith('.pdf'):
        return extract_pdf(file)

    elif filename.endswith('.docx'):
        return extract_docx(file)

    else:
        return file.read().decode('utf-8', errors='ignore')


def extract_pdf(file):
    text = ""
    with pdfplumber.open(file) as pdf:
        for page in pdf.pages:
            text += page.extract_text() or ""
    return text


def extract_docx(file):
    doc = docx.Document(file)
    return "\n".join([para.text for para in doc.paragraphs])


# -------------------------------
# SKILL EXTRACTION
# -------------------------------

SKILL_DB = [
    # Languages
    "python", "java", "c", "c++", "javascript", "kotlin",

    # Frameworks
    "django", "react", "node", "flutter",

    # Databases
    "mongodb", "mysql", "postgresql", "firebase",

    # Domains
    "machine learning", "ai", "iot", "cybersecurity",

    # Tools
    "aws", "docker", "git", "linux"
]


def extract_skills(text):
    text = text.lower()
    found = []

    for skill in SKILL_DB:
        if skill in text:
            found.append(skill)

    return list(set(found))


# -------------------------------
# EXPERIENCE EXTRACTION
# -------------------------------

def extract_experience(text):
    text = text.lower()

    # detect internships / roles
    keywords = ["intern", "experience", "worked", "developer"]

    score = 0
    for k in keywords:
        if k in text:
            score += 5

    return score


# -------------------------------
# PROJECT EXTRACTION
# -------------------------------

def extract_projects(text):
    text = text.lower()

    # count project mentions
    project_count = len(re.findall(r'project', text))

    return project_count