import nodemailer from 'nodemailer'
import { generateOfferLetter } from '@/lib/generateOfferLetter'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Built lazily so env vars are always set at call time (Next.js API routes)
function makeTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

const FROM = () => `"NexusHire" <${process.env.SMTP_USER}>`

// ── Shared HTML shell ─────────────────────────────────────────────────────────
function wrap(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>NexusHire</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Helvetica Neue',Arial,sans-serif;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#111118;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#5b21b6,#7c3aed);padding:28px 36px;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">⬡ NexusHire</p>
            <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.7);">The Transparent Opportunity Graph</p>
          </td>
        </tr>
        <!-- Body -->
        <tr><td style="padding:36px;">${body}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.07);">
            <p style="margin:0;font-size:11px;color:#4b5563;text-align:center;">
              © 2026 NexusHire · <a href="${APP_URL}" style="color:#7c3aed;text-decoration:none;">Visit platform</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function btn(label: string, url: string, color = '#7c3aed'): string {
  return `<a href="${url}" style="display:inline-block;margin-top:20px;padding:12px 28px;background:${color};color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">${label}</a>`
}

function badge(text: string, color = '#7c3aed'): string {
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${color}22;color:${color};font-size:12px;font-weight:600;border:1px solid ${color}44;">${text}</span>`
}

// ── Safe send (never throws — logs on failure) ────────────────────────────────
async function send(to: string, subject: string, html: string) {
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  console.log(`[Mailer] send() called → to=${to} | SMTP_USER set=${!!user} | SMTP_PASS set=${!!pass}`)
  if (!user || !pass) {
    console.warn('[Mailer] SMTP_USER / SMTP_PASS not set — skipping email to', to)
    return
  }
  try {
    const transporter = makeTransport()
    await transporter.sendMail({ from: FROM(), to, subject, html })
    console.log(`[Mailer] ✓ Sent "${subject}" → ${to}`)
  } catch (err) {
    console.error(`[Mailer] ✗ Failed to send "${subject}" → ${to}:`, err)
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. Application Receipt (candidate applied successfully)
// ══════════════════════════════════════════════════════════════════════════════
export async function sendApplicationReceipt(params: {
  to: string
  candidateName: string
  jobTitle: string
  companyName: string
  matchScore: number
  applicationId: string
}) {
  const { to, candidateName, jobTitle, companyName, matchScore, applicationId } = params
  const color = matchScore >= 75 ? '#16a34a' : matchScore >= 50 ? '#d97706' : '#dc2626'
  const html = wrap(`
    <h2 style="margin:0 0 6px;font-size:20px;color:#f1f5f9;">Application submitted! 🎉</h2>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;">Here's your confirmation, ${candidateName}.</p>

    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#f1f5f9;">${jobTitle}</p>
      <p style="margin:0 0 16px;font-size:13px;color:#94a3b8;">${companyName}</p>
      <p style="margin:0;font-size:13px;color:#94a3b8;">Your AI Match Score</p>
      <p style="margin:4px 0 0;font-size:28px;font-weight:700;color:${color};">${matchScore}%</p>
    </div>

    <p style="font-size:14px;color:#94a3b8;line-height:1.6;">
      Your application is now live. The recruiter will review it and update your pipeline stage.
      You'll receive an email the moment anything changes — no more black holes.
    </p>

    ${btn('Track my application', `${APP_URL}/candidate/applications`)}
  `)
  await send(to, `✅ Application submitted — ${jobTitle} at ${companyName}`, html)
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. Stage Update (recruiter moved candidate to a new stage)
// ══════════════════════════════════════════════════════════════════════════════
const STAGE_LABELS: Record<string, string> = {
  applied: 'Applied',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted ⭐',
  interview: 'Interview Round 🎤',
  decision: 'Final Decision',
  outcome: 'Outcome',
}
const STAGE_COLORS: Record<string, string> = {
  applied: '#60a5fa',
  under_review: '#facc15',
  shortlisted: '#34d399',
  interview: '#a78bfa',
  decision: '#fb923c',
  outcome: '#9ca3af',
}

export async function sendStageUpdate(params: {
  to: string
  candidateName: string
  jobTitle: string
  companyName: string
  newStage: string
  recruiterNote?: string
  applicationId: string
}) {
  const { to, candidateName, jobTitle, companyName, newStage, recruiterNote, applicationId } = params
  const label = STAGE_LABELS[newStage] || newStage
  const color = STAGE_COLORS[newStage] || '#7c3aed'

  const html = wrap(`
    <h2 style="margin:0 0 6px;font-size:20px;color:#f1f5f9;">Your application moved! 🚀</h2>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;">Good news, ${candidateName}. There's been an update on your application.</p>

    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#f1f5f9;">${jobTitle}</p>
      <p style="margin:0 0 16px;font-size:13px;color:#94a3b8;">${companyName}</p>
      <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">New Stage</p>
      ${badge(label, color)}
    </div>

    ${recruiterNote ? `
    <div style="background:rgba(124,58,237,0.08);border-left:3px solid #7c3aed;border-radius:4px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:11px;color:#7c3aed;font-weight:600;text-transform:uppercase;">Recruiter Note</p>
      <p style="margin:0;font-size:14px;color:#e2e8f0;line-height:1.6;">"${recruiterNote}"</p>
    </div>` : ''}

    <p style="font-size:14px;color:#94a3b8;line-height:1.6;">
      Log in to see your full pipeline tracker, match score breakdown, and percentile rank.
    </p>

    ${btn('View my pipeline', `${APP_URL}/candidate/applications`)}
  `)
  await send(to, `📬 Application update: ${label} — ${jobTitle}`, html)
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. Rejection with AI feedback CTA
// ══════════════════════════════════════════════════════════════════════════════
export async function sendRejectionEmail(params: {
  to: string
  candidateName: string
  jobTitle: string
  companyName: string
  matchScore: number
  applicationId: string
  recruiterNote?: string
}) {
  const { to, candidateName, jobTitle, companyName, matchScore, applicationId, recruiterNote } = params
  const html = wrap(`
    <h2 style="margin:0 0 6px;font-size:20px;color:#f1f5f9;">Application update for ${jobTitle}</h2>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;">Hi ${candidateName}, we have an update on your application.</p>

    <div style="background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.2);border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#f1f5f9;">${jobTitle}</p>
      <p style="margin:0 0 12px;font-size:13px;color:#94a3b8;">${companyName}</p>
      <p style="margin:0;font-size:13px;color:#f87171;">Unfortunately, the recruiter has decided not to move forward with your application at this time. Your match score was <strong>${matchScore}%</strong>.</p>
    </div>

    ${recruiterNote ? `
    <div style="background:rgba(124,58,237,0.08);border-left:3px solid #7c3aed;border-radius:4px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:11px;color:#7c3aed;font-weight:600;text-transform:uppercase;">Recruiter's Note</p>
      <p style="margin:0;font-size:14px;color:#e2e8f0;line-height:1.6;">"${recruiterNote}"</p>
    </div>` : ''}

    <div style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:12px;padding:20px;margin-bottom:8px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#a78bfa;">✦ Your AI Rejection Analysis is ready</p>
      <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
        NexusHire has generated a personalised rejection analysis — comparing your profile against the candidates who were selected,
        interpreting the recruiter's feedback, and giving you a concrete skill gap learning path.
      </p>
      ${btn('View AI Rejection Analysis', `${APP_URL}/candidate/skill-gap?applicationId=${applicationId}&rejected=true`, '#7c3aed')}
    </div>

    <p style="font-size:12px;color:#4b5563;margin-top:20px;">
      Rejection is part of the process. Use this analysis to come back stronger. 💪
    </p>
  `)
  await send(to, `Application update — ${jobTitle} at ${companyName}`, html)
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. Hired Email (Celebratory + PDF Offer Letter attachment)
// ══════════════════════════════════════════════════════════════════════════════
export async function sendHiredEmail(params: {
  to: string
  candidateName: string
  jobTitle: string
  companyName: string
  recruiterName?: string
  location?: string
  workType?: string
  salaryRange?: { min: number; max: number; currency: string }
  recruiterNote?: string
}) {
  const { to, candidateName, jobTitle, companyName, recruiterName, location, workType, salaryRange, recruiterNote } = params

  // Generate PDF offer letter
  let pdfBuffer: Buffer | null = null
  try {
    pdfBuffer = await generateOfferLetter({
      candidateName,
      jobTitle,
      companyName,
      recruiterName: recruiterName || 'Hiring Manager',
      location,
      workType,
      salaryRange,
      recruiterNote,
    })
    console.log('[Mailer] PDF offer letter generated, size:', pdfBuffer.length, 'bytes')
  } catch (pdfErr) {
    console.error('[Mailer] PDF generation FAILED:', pdfErr instanceof Error ? pdfErr.message : pdfErr)
  }

  const salaryLine = salaryRange && salaryRange.max > 0
    ? `<p style="margin:4px 0 0;font-size:13px;color:#16a34a;font-weight:600;">${salaryRange.currency} ${salaryRange.min.toLocaleString()} – ${salaryRange.max.toLocaleString()} p.a.</p>`
    : ''

  const html = wrap(`
    <h2 style="margin:0 0 6px;font-size:24px;color:#f1f5f9;">You're Hired! 🎉</h2>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;">Incredible news, ${candidateName}. The team at ${companyName} wants you on board.</p>

    <div style="background:linear-gradient(135deg,rgba(22,163,74,0.12),rgba(16,185,129,0.06));border:1px solid rgba(22,163,74,0.3);border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 8px;font-size:14px;color:#16a34a;text-transform:uppercase;letter-spacing:0.05em;font-weight:700;">Offer Extended</p>
      <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#f1f5f9;">${jobTitle}</p>
      <p style="margin:0;font-size:14px;color:#94a3b8;">${companyName}${location ? ` · ${location}` : ''}${workType ? ` · ${workType.charAt(0).toUpperCase() + workType.slice(1)}` : ''}</p>
      ${salaryLine}
    </div>

    ${recruiterNote ? `
    <div style="background:rgba(124,58,237,0.08);border-left:3px solid #7c3aed;border-radius:4px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:11px;color:#7c3aed;font-weight:600;text-transform:uppercase;">Message from the Hiring Manager</p>
      <p style="margin:0;font-size:14px;color:#e2e8f0;line-height:1.6;">"${recruiterNote}"</p>
    </div>` : ''}

    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:13px;color:#a78bfa;font-weight:600;">📎 Offer Letter Attached</p>
      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">Your official offer letter is attached to this email as a PDF. Please review it carefully and reply to accept within 5 business days.</p>
    </div>

    <p style="font-size:14px;color:#94a3b8;line-height:1.6;margin-bottom:20px;">
      The recruiter will be in touch shortly with the official start date and onboarding details. Congratulations on passing the gauntlet!
    </p>

    ${btn('View application', `${APP_URL}/candidate/applications`, '#16a34a')}
  `)

  // Send with or without attachment
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  console.log(`[Mailer] send() called → to=${to} | SMTP_USER set=${!!user} | SMTP_PASS set=${!!pass}`)
  if (!user || !pass) {
    console.warn('[Mailer] SMTP_USER / SMTP_PASS not set — skipping hired email to', to)
    return
  }
  try {
    const transporter = makeTransport()
    await transporter.sendMail({
      from: FROM(),
      to,
      subject: `🎉 You're Hired! — ${jobTitle} at ${companyName}`,
      html,
      ...(pdfBuffer ? {
        attachments: [{
          filename: `Offer_Letter_${jobTitle.replace(/\s+/g, '_')}_${companyName.replace(/\s+/g, '_')}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        }],
      } : {}),
    })
    console.log(`[Mailer] ✓ Sent hired email ${pdfBuffer ? '(with PDF)' : '(no PDF)'} → ${to}`)
  } catch (err) {
    console.error(`[Mailer] ✗ Failed to send hired email → ${to}:`, err)
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// 5. Top-tier applicant alert for recruiter (score ≥ 85%)
// ══════════════════════════════════════════════════════════════════════════════
export async function sendTopApplicantAlert(params: {
  to: string
  recruiterName: string
  jobTitle: string
  candidateName: string
  matchScore: number
  jobId: string
}) {
  const { to, recruiterName, jobTitle, candidateName, matchScore, jobId } = params
  const html = wrap(`
    <h2 style="margin:0 0 6px;font-size:20px;color:#f1f5f9;">Unicorn candidate alert 🦄</h2>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;">Hi ${recruiterName}, a high-calibre applicant just applied to one of your roles.</p>

    <div style="background:linear-gradient(135deg,rgba(22,163,74,0.12),rgba(16,185,129,0.06));border:1px solid rgba(22,163,74,0.3);border-radius:12px;padding:24px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#f1f5f9;">${candidateName}</p>
      <p style="margin:0 0 16px;font-size:13px;color:#94a3b8;">Applied for: <strong style="color:#e2e8f0;">${jobTitle}</strong></p>
      <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">AI Match Score</p>
      <p style="margin:0;font-size:36px;font-weight:700;color:#16a34a;">${matchScore}%</p>
    </div>

    <p style="font-size:14px;color:#94a3b8;line-height:1.6;">
      This candidate is in the top tier. Candidates with scores above 85% are rare — we recommend reviewing their profile before they receive other offers.
    </p>

    ${btn('View applicant graph', `${APP_URL}/recruiter/jobs/${jobId}/graph`, '#16a34a')}
  `)
  await send(to, `🦄 Top-tier applicant (${matchScore}%) — ${jobTitle}`, html)
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. Daily pipeline summary for recruiter
// ══════════════════════════════════════════════════════════════════════════════
export async function sendDailyPipelineSummary(params: {
  to: string
  recruiterName: string
  summary: Array<{
    jobTitle: string
    newApplicants: number
    highMatchCount: number  // score >= 75
    jobId: string
  }>
  totalNew: number
  totalHighMatch: number
}) {
  const { to, recruiterName, summary, totalNew, totalHighMatch } = params
  if (totalNew === 0) return // nothing to report

  const rows = summary.map(j => `
    <tr>
      <td style="padding:10px 12px;font-size:13px;color:#e2e8f0;border-bottom:1px solid rgba(255,255,255,0.05);">${j.jobTitle}</td>
      <td style="padding:10px 12px;font-size:13px;color:#94a3b8;text-align:center;border-bottom:1px solid rgba(255,255,255,0.05);">${j.newApplicants}</td>
      <td style="padding:10px 12px;font-size:13px;color:#16a34a;text-align:center;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.05);">${j.highMatchCount}</td>
      <td style="padding:10px 12px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.05);">
        <a href="${APP_URL}/recruiter/jobs/${j.jobId}/graph" style="color:#7c3aed;font-size:12px;text-decoration:none;">View graph →</a>
      </td>
    </tr>
  `).join('')

  const html = wrap(`
    <h2 style="margin:0 0 6px;font-size:20px;color:#f1f5f9;">Your daily pipeline summary 📊</h2>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;">Good morning, ${recruiterName}. Here's what happened in the last 24 hours.</p>

    <div style="display:flex;gap:16px;margin-bottom:24px;">
      <div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;text-align:center;">
        <p style="margin:0;font-size:28px;font-weight:700;color:#f1f5f9;">${totalNew}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">New applicants</p>
      </div>
      <div style="flex:1;background:rgba(22,163,74,0.08);border:1px solid rgba(22,163,74,0.2);border-radius:10px;padding:16px;text-align:center;">
        <p style="margin:0;font-size:28px;font-weight:700;color:#16a34a;">${totalHighMatch}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">High match (75%+)</p>
      </div>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(255,255,255,0.08);border-radius:10px;overflow:hidden;margin-bottom:24px;">
      <thead>
        <tr style="background:rgba(255,255,255,0.04);">
          <th style="padding:10px 12px;font-size:11px;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:0.05em;">Job</th>
          <th style="padding:10px 12px;font-size:11px;color:#94a3b8;text-align:center;text-transform:uppercase;letter-spacing:0.05em;">New</th>
          <th style="padding:10px 12px;font-size:11px;color:#94a3b8;text-align:center;text-transform:uppercase;letter-spacing:0.05em;">75%+</th>
          <th style="padding:10px 12px;font-size:11px;color:#94a3b8;text-align:center;text-transform:uppercase;letter-spacing:0.05em;"></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    ${btn('Open recruiter dashboard', `${APP_URL}/recruiter/dashboard`)}
  `)
  await send(to, `📊 Daily pipeline: ${totalNew} new applicants, ${totalHighMatch} high-match`, html)
}
