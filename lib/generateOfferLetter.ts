import PDFDocument from 'pdfkit'

export interface OfferLetterParams {
  candidateName: string
  jobTitle: string
  companyName: string
  recruiterName: string
  location?: string
  workType?: string
  salaryRange?: { min: number; max: number; currency: string }
  experienceRange?: { min: number; max: number }
  startDate?: string          // e.g. "April 7, 2026" — recruiter can pass or we default to 2 weeks out
  recruiterNote?: string
}

/** Returns a Buffer containing the PDF offer letter */
export async function generateOfferLetter(p: OfferLetterParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: 'A4' })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const date = new Date().toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
    const joiningDate = p.startDate || (() => {
      const d = new Date()
      d.setDate(d.getDate() + 14)
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    })()

    const salary = p.salaryRange && p.salaryRange.max > 0
      ? `${p.salaryRange.currency} ${p.salaryRange.min.toLocaleString()} – ${p.salaryRange.max.toLocaleString()} per annum`
      : null

    const workType = p.workType
      ? p.workType.charAt(0).toUpperCase() + p.workType.slice(1)
      : 'Hybrid'

    // ── Brand bar ─────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 70).fill('#5b21b6')
    doc.fillColor('#fff').fontSize(20).font('Helvetica-Bold')
       .text('⬡  NexusHire', 60, 22)
    doc.fillColor('rgba(255,255,255,0.6)').fontSize(9).font('Helvetica')
       .text('The Transparent Opportunity Graph', 60, 46)

    doc.moveDown(3)

    // ── Date & header ────────────────────────────────────────────────
    doc.fillColor('#374151').fontSize(10).font('Helvetica')
       .text(date, { align: 'right' })

    doc.moveDown(1.2)
    doc.fillColor('#111827').fontSize(22).font('Helvetica-Bold')
       .text('Offer of Employment', { align: 'center' })

    doc.moveDown(0.4)
    doc
      .moveTo(60, doc.y).lineTo(doc.page.width - 60, doc.y)
      .strokeColor('#7c3aed').lineWidth(2).stroke()

    doc.moveDown(1.5)

    // ── Salutation ────────────────────────────────────────────────────
    doc.fillColor('#111827').fontSize(11).font('Helvetica')
       .text(`Dear ${p.candidateName},`)

    doc.moveDown(0.8)
    doc.fontSize(11).font('Helvetica')
       .text(
         `We are delighted to extend this formal offer of employment to you for the position of ` +
         `${p.jobTitle} at ${p.companyName}. After a thorough review of your profile and interview ` +
         `process coordinated through NexusHire, we believe you are an exceptional fit for our team.`,
         { lineGap: 4, align: 'justify' }
       )

    // ── Offer table ────────────────────────────────────────────────────
    doc.moveDown(1.2)
    doc.fillColor('#7c3aed').fontSize(11).font('Helvetica-Bold')
       .text('Offer Details')
    doc.moveDown(0.4)

    const rows: Array<[string, string]> = [
      ['Position', p.jobTitle],
      ['Company', p.companyName],
      ['Work Mode', workType],
      ...(p.location ? [['Location', p.location] as [string, string]] : []),
      ...(salary ? [['Compensation', salary] as [string, string]] : []),
      ['Proposed Start Date', joiningDate],
    ]

    const tableTop = doc.y
    const col1 = 60
    const col2 = 220

    rows.forEach((row, i) => {
      const y = tableTop + i * 26
      if (i % 2 === 0) {
        doc.rect(col1 - 8, y - 5, doc.page.width - 104, 24).fill('#f5f3ff')
      }
      doc.fillColor('#6b21a8').font('Helvetica-Bold').fontSize(10)
         .text(row[0], col1, y, { width: 150 })
      doc.fillColor('#111827').font('Helvetica').fontSize(10)
         .text(row[1], col2, y, { width: doc.page.width - col2 - 60 })
    })

    doc.y = tableTop + rows.length * 26 + 10

    // ── Recruiter message (optional) ───────────────────────────────────
    if (p.recruiterNote?.trim()) {
      doc.moveDown(1)
      doc.rect(52, doc.y - 4, 3, 50).fill('#7c3aed')
      doc.fillColor('#374151').fontSize(10).font('Helvetica-Oblique')
         .text(`"${p.recruiterNote}"`, 64, doc.y, { lineGap: 3, align: 'justify', width: doc.page.width - 124 })
    }

    // ── Body closing ───────────────────────────────────────────────────
    doc.moveDown(1.5)
    doc.fillColor('#111827').fontSize(11).font('Helvetica')
       .text(
         `This offer is contingent upon successful completion of any required background checks and ` +
         `signing of the company's standard employment agreement. Please confirm your acceptance by ` +
         `replying to this email or contacting us through the NexusHire platform within 5 business days.`,
         { lineGap: 4, align: 'justify' }
       )

    doc.moveDown(1)
    doc.text(
      `We look forward to welcoming you to the team. Congratulations once again!`,
      { lineGap: 4 }
    )

    // ── Signature block ────────────────────────────────────────────────
    doc.moveDown(2)
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11)
       .text('Warm regards,')
    doc.moveDown(0.3)
    doc.font('Helvetica').fontSize(11).text(p.recruiterName)
    doc.fillColor('#6b7280').fontSize(10).text(`Hiring Manager · ${p.companyName}`)
    doc.fillColor('#7c3aed').fontSize(9).text('via NexusHire Platform')

    // ── Footer bar ─────────────────────────────────────────────────────
    const pageBottom = doc.page.height - 40
    doc.rect(0, pageBottom, doc.page.width, 40).fill('#5b21b6')
    doc.fillColor('rgba(255,255,255,0.7)').fontSize(8).font('Helvetica')
       .text(
         `This document was generated by NexusHire · nexushire.com · Confidential`,
         60, pageBottom + 14, { align: 'center', width: doc.page.width - 120 }
       )

    doc.end()
  })
}
