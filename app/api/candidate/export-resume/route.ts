import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import connectDB from '@/lib/db'
import CandidateProfile from '@/lib/models/CandidateProfile'
import User from '@/lib/models/User'
import PDFDocument from 'pdfkit'

// ── Layout constants (Letter, 0.5in margins) ──────────────────────────────────
const ML = 36          // left/right margin  (0.5 in)
const MT = 32          // top margin         (~0.45 in)
const PW = 612         // page width  (Letter)
const CW = PW - 2 * ML  // content width = 540

// ── Helpers ───────────────────────────────────────────────────────────────────

function sectionHeader(doc: PDFKit.PDFDocument, title: string) {
  // Avoid orphaned headers near page bottom
  if (doc.y > 700) doc.addPage()
  doc.moveDown(0.35)
  doc.font('Times-Bold').fontSize(11).fillColor('#000000')
    .text(title.toUpperCase(), ML, doc.y, { width: CW, characterSpacing: 0.4, lineGap: 0 })
  const ly = doc.y + 1
  doc.moveTo(ML, ly).lineTo(PW - ML, ly).strokeColor('#000000').lineWidth(0.75).stroke()
  doc.y = ly + 5
}

/** Render a single bullet line. Handles multi-line text gracefully. */
function bullet(doc: PDFKit.PDFDocument, text: string, indent = 10) {
  if (!text.trim()) return
  const bX = ML + indent
  const tX = bX + 8
  const tW = CW - indent - 8
  const y0 = doc.y
  doc.font('Times-Roman').fontSize(10).fillColor('#000000')
    .text('\u2022', bX, y0, { lineGap: 0, continued: false })
  doc.font('Times-Roman').fontSize(10).fillColor('#000000')
    .text(text.trim(), tX, y0, { width: tW, lineGap: 1, align: 'left' })
}

/** Split description string into bullet lines (newline or `. ` separated). */
function descToBullets(description: string): string[] {
  if (!description?.trim()) return []
  const lines = description.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length > 1) return lines
  // Single block — return as one bullet
  return [description.trim()]
}

/** Draw the education table with full borders */
function drawEduTable(
  doc: PDFKit.PDFDocument,
  rows: string[][]
) {
  const headers = ['Degree', 'Institute', 'Year', 'CGPA']
  const colW = [Math.round(CW * 0.315), Math.round(CW * 0.44), Math.round(CW * 0.12), CW - Math.round(CW * 0.315) - Math.round(CW * 0.44) - Math.round(CW * 0.12)]
  // colW ≈ [170, 238, 65, 67] → total = 540

  const FONT_SZ = 9.5
  const PAD = 4

  // Calculate heights
  function rowHeight(cells: string[]): number {
    doc.font('Times-Roman').fontSize(FONT_SZ)
    const cellHeights = cells.map((text, i) =>
      doc.heightOfString(text || '', { width: colW[i] - 2 * PAD })
    )
    return Math.max(18, Math.max(...cellHeights) + 2 * PAD)
  }

  let y = doc.y

  // Draw header
  const hdrH = rowHeight(headers)
  let cx = ML
  headers.forEach((h, i) => {
    doc.rect(cx, y, colW[i], hdrH).stroke()
    doc.font('Times-Bold').fontSize(FONT_SZ).fillColor('#000000')
      .text(h, cx + PAD, y + PAD, { width: colW[i] - 2 * PAD, align: 'center', lineGap: 0 })
    cx += colW[i]
  })
  y += hdrH

  // Draw data rows
  rows.forEach((row) => {
    const rH = rowHeight(row)
    cx = ML
    row.forEach((cell, i) => {
      doc.rect(cx, y, colW[i], rH).stroke()
      doc.font('Times-Roman').fontSize(FONT_SZ).fillColor('#000000')
        .text(cell || '', cx + PAD, y + PAD, { width: colW[i] - 2 * PAD, align: 'center', lineGap: 0 })
      cx += colW[i]
    })
    y += rH
  })

  doc.y = y + 6
}

/** Draw skills in two-column layout: bold category | comma-separated skills */
function drawSkillsSection(
  doc: PDFKit.PDFDocument,
  skillGroups: { category: string; skills: string[] }[]
) {
  const catW = 155
  const skillsW = CW - catW
  const FONT_SZ = 10

  skillGroups.forEach(({ category, skills }) => {
    if (!category || skills.length === 0) return
    const skillStr = skills.join(', ')
    doc.font('Times-Roman').fontSize(FONT_SZ)
    const skillsH = doc.heightOfString(skillStr, { width: skillsW - 4 })
    doc.font('Times-Bold').fontSize(FONT_SZ)
    const catH = doc.heightOfString(category, { width: catW - 4 })
    const lineH = Math.max(skillsH, catH)

    const y0 = doc.y
    doc.font('Times-Bold').fontSize(FONT_SZ).fillColor('#000000')
      .text(category, ML, y0, { width: catW - 4, lineGap: 0 })
    doc.font('Times-Roman').fontSize(FONT_SZ).fillColor('#000000')
      .text(skillStr, ML + catW, y0, { width: skillsW, lineGap: 0 })
    doc.y = y0 + lineH + 3
  })
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET() {
  try {
  const session = await auth()
  if (!session || session.user.role !== 'candidate') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()
  const [profile, user] = await Promise.all([
    CandidateProfile.findOne({ userId: session.user.id }).lean() as Promise<Record<string, unknown> | null>,
    User.findById(session.user.id).select('name email').lean() as Promise<Record<string, unknown> | null>,
  ])

  if (!profile || !user) {
    return NextResponse.json({ error: 'Profile not found. Complete your profile first.' }, { status: 404 })
  }

  type Exp = { title: string; company: string; startDate: string; endDate?: string; current?: boolean; description: string }
  type Edu = { degree: string; institution: string; year: string; field?: string; cgpa?: string }
  type Proj = { name: string; description: string; techStack: string[]; url?: string }
  type Cert = { title: string; url?: string }
  type SkGrp = { category: string; skills: string[] }
  type Skill = { skill: string; proficiency: string }

  const experience = (profile.experience as Exp[]) || []
  const education = (profile.education as Edu[]) || []
  const projects = (profile.projects as Proj[]) || []
  const certifications = (profile.certifications as Cert[]) || []
  const achievements = (profile.achievements as string[]) || []
  const skillGroups = (profile.skillGroups as SkGrp[]) || []
  const flatSkills = (profile.skills as Skill[]) || []

  // Fallback skill groups from flat list
  const effectiveSkillGroups: SkGrp[] = skillGroups.length > 0
    ? skillGroups
    : flatSkills.length > 0
      ? [{ category: 'Technical Skills', skills: flatSkills.map((s) => s.skill) }]
      : []

  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: ML, size: 'LETTER', autoFirstPage: true })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // ── HEADER ────────────────────────────────────────────────────────────
    const candidateName = String(user.name || 'Candidate')
    doc.font('Times-Bold').fontSize(20).fillColor('#000000')
      .text(candidateName, ML, MT, { align: 'center', width: CW, lineGap: 0 })

    // Phone | Email line
    const contactLine: string[] = []
    if (profile.phone) contactLine.push(String(profile.phone))
    if (user.email) contactLine.push(String(user.email))
    if (contactLine.length > 0) {
      doc.moveDown(0.25)
      doc.font('Times-Roman').fontSize(10).fillColor('#000000')
        .text(contactLine.join(' | '), ML, doc.y, { align: 'center', width: CW, lineGap: 0 })
    }

    // Links line
    const linkParts: { text: string; url: string }[] = []
    if (profile.portfolioUrl) linkParts.push({ text: simplifyUrl(String(profile.portfolioUrl)), url: String(profile.portfolioUrl) })
    if (profile.linkedinUrl) linkParts.push({ text: simplifyUrl(String(profile.linkedinUrl)), url: String(profile.linkedinUrl) })
    if (profile.githubUrl) linkParts.push({ text: simplifyUrl(String(profile.githubUrl)), url: String(profile.githubUrl) })
    if (profile.tryhackmeUrl) linkParts.push({ text: simplifyUrl(String(profile.tryhackmeUrl)), url: String(profile.tryhackmeUrl) })

    if (linkParts.length > 0) {
      doc.moveDown(0.25)
      // Render the full link line as a single centred call to avoid PDFKit
      // NaN / overlap bugs that arise from continued+align combinations.
      doc.font('Times-Roman').fontSize(10).fillColor('#000080')
        .text(linkParts.map((l) => l.text).join(' | '), ML, doc.y, {
          width: CW, align: 'center', lineGap: 0,
        })
      doc.fillColor('#000000')
    }

    doc.moveDown(0.3)

    // ── PROFESSIONAL SUMMARY ──────────────────────────────────────────────
    if (profile.bio) {
      sectionHeader(doc, 'Professional Summary')
      doc.font('Times-Roman').fontSize(10).fillColor('#000000')
        .text(String(profile.bio), ML, doc.y, { width: CW, lineGap: 1.5, align: 'justify' })
    }

    // ── EDUCATION ─────────────────────────────────────────────────────────
    if (education.length > 0) {
      sectionHeader(doc, 'Education')
      const eduRows = education.map((e) => [
        [e.degree, e.field ? `\nwith ${e.field}` : ''].join(''),
        e.institution || '',
        e.year || '',
        e.cgpa || '',
      ])
      drawEduTable(doc, eduRows)
    }

    // ── TECHNICAL SKILLS ──────────────────────────────────────────────────
    if (effectiveSkillGroups.length > 0) {
      sectionHeader(doc, 'Technical Skills')
      drawSkillsSection(doc, effectiveSkillGroups)
    }

    // ── EXPERIENCE ────────────────────────────────────────────────────────
    if (experience.length > 0) {
      sectionHeader(doc, 'Experience')
      experience.forEach((exp) => {
        if (doc.y > 700) doc.addPage()
        const dateStr = exp.current
          ? `${exp.startDate} \u2013 Present`
          : `${exp.startDate}${exp.endDate ? ` \u2013 ${exp.endDate}` : ''}`

        const y0 = doc.y
        // Title bold, date right-aligned on same line
        doc.font('Times-Bold').fontSize(10).fillColor('#000000')
          .text(exp.title, ML, y0, { width: CW, continued: true, lineGap: 0 })
        doc.font('Times-Roman').fontSize(10).fillColor('#000000')
          .text(dateStr, { align: 'right', continued: false, lineGap: 0 })

        // Company on next line (italic)
        doc.font('Times-Italic').fontSize(10).fillColor('#000000')
          .text(exp.company, ML, doc.y, { lineGap: 0 })

        doc.moveDown(0.15)
        descToBullets(exp.description).forEach((b) => bullet(doc, b))
        doc.moveDown(0.4)
      })
    }

    // ── PROJECTS ──────────────────────────────────────────────────────────
    if (projects.length > 0) {
      sectionHeader(doc, 'Projects')
      projects.forEach((proj) => {
        if (doc.y > 700) doc.addPage()
        const y0 = doc.y

        // Project name (bold) — Link (blue)
        doc.font('Times-Bold').fontSize(10).fillColor('#000000')
          .text(proj.name, ML, y0, { continued: !!proj.url, lineGap: 0 })
        if (proj.url) {
          doc.font('Times-Roman').fontSize(10).fillColor('#000000')
            .text(' \u2014 ', { continued: true, lineGap: 0 })
          doc.fillColor('#000080')
            .text(proj.url, { link: proj.url, underline: false, continued: false, lineGap: 0 })
        }

        // Tech stack in italic
        if (proj.techStack?.length) {
          doc.font('Times-Italic').fontSize(9.5).fillColor('#333333')
            .text(proj.techStack.join(', '), ML, doc.y, { lineGap: 0 })
        }

        doc.moveDown(0.1)
        descToBullets(proj.description).forEach((b) => bullet(doc, b))
        doc.moveDown(0.4)
      })
    }

    // ── CERTIFICATIONS ────────────────────────────────────────────────────
    if (certifications.length > 0) {
      sectionHeader(doc, 'Certifications')
      certifications.forEach((cert) => {
        if (!cert.title) return
        const y0 = doc.y
        doc.font('Times-Roman').fontSize(10).fillColor('#000000')
          .text('\u2022', ML + 10, y0, { lineGap: 0, continued: false })
        if (cert.url) {
          doc.fillColor('#000080').font('Times-Roman').fontSize(10)
            .text(cert.title, ML + 20, y0, { link: cert.url, underline: false, lineGap: 0 })
        } else {
          doc.fillColor('#000000').font('Times-Roman').fontSize(10)
            .text(cert.title, ML + 20, y0, { lineGap: 0 })
        }
      })
      doc.moveDown(0.2)
    }

    // ── ACHIEVEMENTS ──────────────────────────────────────────────────────
    if (achievements.length > 0) {
      sectionHeader(doc, 'Achievements')
      achievements.forEach((ach) => {
        if (!ach?.trim()) return
        bullet(doc, ach)
      })
    }

    doc.end()
  })

  const safeFilename = safeUserFilename(user) + '_resume.pdf'

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
      'Content-Length': String(pdfBuffer.length),
    },
  })
  } catch (err) {
    console.error('Export resume error:', err)
    return NextResponse.json({ error: 'Failed to generate PDF. Please try again.' }, { status: 500 })
  }
}

function simplifyUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '')
}

function safeUserFilename(user: Record<string, unknown>): string {
  return String(user.name || 'resume').replace(/\s+/g, '_')
}
