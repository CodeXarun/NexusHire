'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Navbar } from '@/components/Navbar'
import { toast } from 'sonner'
import {
  Loader2, Plus, X, Save, Sparkles, Wand2, Download,
  FileText, BarChart3, CheckCircle2, XCircle, ClipboardPaste,
  RefreshCw, Trophy, ArrowLeft, Tags, Zap,
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────
interface SkillGroup { category: string; skills: string }
interface EduRow { degree: string; institution: string; year: string; cgpa: string; field: string }
interface ExpRow { title: string; company: string; startDate: string; endDate: string; current: boolean; description: string }
interface ProjRow { name: string; url: string; techStack: string; description: string }
interface CertRow { title: string; url: string }

interface ATSResult {
  atsScore: number
  matchedKeywords: string[]
  missingKeywords: string[]
  feedback: string
}

interface ResumeForm {
  name: string; phone: string; headline: string; location: string
  github: string; linkedin: string; portfolio: string; tryhackme: string
  bio: string
  flatSkills: string          // comma-separated, used for quick entry + auto-categorize
  skillGroups: SkillGroup[]   // categorised rows shown after auto-categorize or manual edit
  education: EduRow[]
  experience: ExpRow[]
  projects: ProjRow[]
  certifications: CertRow[]
  achievements: string[]
}

const EMPTY_FORM: ResumeForm = {
  name: '', phone: '', headline: '', location: '',
  github: '', linkedin: '', portfolio: '', tryhackme: '',
  bio: '',
  flatSkills: '',
  skillGroups: [],
  education: [{ degree: '', institution: '', year: '', cgpa: '', field: '' }],
  experience: [],
  projects: [],
  certifications: [{ title: '', url: '' }],
  achievements: [''],
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-6 mb-5 gradient-border">
      <h2 className="font-semibold text-base mb-4">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  )
}

const input = 'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all'
const textarea = 'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all resize-none'

function AiBtn({ onClick, loading, label = 'Enhance' }: { onClick: () => void; loading: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-300 hover:bg-violet-500/20 transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
      {loading ? 'Working…' : label}
    </button>
  )
}

// ─── Score ring for ATS tab ───────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r = 52, circ = 2 * Math.PI * r
  const filled = (score / 100) * circ
  const color = score >= 70 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#ef4444'
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="130" height="130" className="-rotate-90">
        <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ResumeBuilderPage() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'build' | 'ats' | 'export'>('build')
  const [form, setForm] = useState<ResumeForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // AI loading states
  const [genSummary, setGenSummary] = useState(false)
  const [autoCat, setAutoCat] = useState(false)
  const [improvingExp, setImprovingExp] = useState<number | null>(null)
  const [improvingProj, setImprovingProj] = useState<number | null>(null)
  const [enhancingAch, setEnhancingAch] = useState(false)

  // ATS state
  const [jd, setJd] = useState('')
  const [atsChecking, setAtsChecking] = useState(false)
  const [atsResult, setAtsResult] = useState<ATSResult | null>(null)

  // Export state
  const [downloading, setDownloading] = useState(false)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['candidate-profile'],
    queryFn: () => fetch('/api/candidate/profile').then((r) => r.json()),
  })

  // Populate form from profile
  useEffect(() => {
    if (!profile || isLoading) return
    setForm({
      name: profile.name || session?.user?.name || '',
      phone: profile.phone || '',
      headline: profile.headline || '',
      location: profile.location || '',
      github: profile.githubUrl || '',
      linkedin: profile.linkedinUrl || '',
      portfolio: profile.portfolioUrl || '',
      tryhackme: profile.tryhackmeUrl || '',
      bio: profile.bio || '',
      flatSkills: profile.skills?.length
        ? (profile.skills as { skill: string }[]).map((s) => s.skill).join(', ')
        : profile.skillGroups?.length
          ? (profile.skillGroups as { skills: string[] }[]).flatMap((g) => g.skills).join(', ')
          : '',
      skillGroups: profile.skillGroups?.length
        ? profile.skillGroups.map((g: { category: string; skills: string[] }) => ({
            category: g.category,
            skills: Array.isArray(g.skills) ? g.skills.join(', ') : g.skills,
          }))
        : [],
      education: profile.education?.length
        ? profile.education.map((e: { degree: string; institution: string; year: string; field?: string; cgpa?: string }) => ({
            degree: e.degree || '',
            institution: e.institution || '',
            year: e.year || '',
            cgpa: e.cgpa || '',
            field: e.field || '',
          }))
        : [{ degree: '', institution: '', year: '', cgpa: '', field: '' }],
      experience: (profile.experience || []).map((e: { title: string; company: string; startDate: string; endDate?: string; current?: boolean; description: string }) => ({
        title: e.title || '',
        company: e.company || '',
        startDate: e.startDate || '',
        endDate: e.endDate || '',
        current: !!e.current,
        description: e.description || '',
      })),
      projects: (profile.projects || []).map((p: { name: string; url?: string; techStack?: string[]; description: string }) => ({
        name: p.name || '',
        url: p.url || '',
        techStack: Array.isArray(p.techStack) ? p.techStack.join(', ') : (p.techStack || ''),
        description: p.description || '',
      })),
      certifications: profile.certifications?.length
        ? profile.certifications.map((c: { title: string; url?: string }) => ({ title: c.title || '', url: c.url || '' }))
        : [{ title: '', url: '' }],
      achievements: profile.achievements?.length ? profile.achievements : [''],
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  // ─── Save ────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    try {
      const body = {
        name: form.name,
        headline: form.headline,
        bio: form.bio,
        location: form.location,
        phone: form.phone,
        githubUrl: form.github,
        linkedinUrl: form.linkedin,
        portfolioUrl: form.portfolio,
        tryhackmeUrl: form.tryhackme,
        skillGroups: form.skillGroups
          .filter((g) => g.category.trim())
          .map((g) => ({
            category: g.category,
            skills: g.skills.split(',').map((s) => s.trim()).filter(Boolean),
          })),
        education: form.education.filter((e) => e.degree.trim()),
        experience: form.experience.filter((e) => e.title.trim()),
        projects: form.projects
          .filter((p) => p.name.trim())
          .map((p) => ({
            name: p.name,
            url: p.url,
            techStack: p.techStack.split(',').map((s) => s.trim()).filter(Boolean),
            description: p.description,
          })),
        certifications: form.certifications.filter((c) => c.title.trim()),
        achievements: form.achievements.filter((a) => a.trim()),
      }
      const res = await fetch('/api/candidate/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success('Resume saved!')
      queryClient.invalidateQueries({ queryKey: ['candidate-profile'] })
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // ─── AI: Generate Summary ────────────────────────────────────────────────
  async function handleGenSummary() {
    setGenSummary(true)
    try {
      const res = await fetch('/api/candidate/generate-summary', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setForm((f) => ({ ...f, bio: data.summary }))
      toast.success('Summary generated!')
    } catch { toast.error('Generation failed') }
    finally { setGenSummary(false) }
  }

  // ─── AI: Auto-categorize skills ──────────────────────────────────────────
  async function handleAutoCategorize() {
    // Collect from flatSkills textarea first, then any existing group rows
    const fromFlat = form.flatSkills.split(',').map((s) => s.trim()).filter(Boolean)
    const fromGroups = form.skillGroups.flatMap((g) =>
      g.skills.split(',').map((s) => s.trim()).filter(Boolean)
    )
    const allSkills = [...new Set([...fromFlat, ...fromGroups])]
    if (allSkills.length === 0) { toast.error('Type your skills in the box above first'); return }
    setAutoCat(true)
    try {
      const res = await fetch('/api/candidate/categorize-skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills: allSkills }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const newGroups: SkillGroup[] = [
        { category: 'Programming Languages', skills: data.languages?.join(', ') || '' },
        { category: 'Frameworks & Libraries', skills: data.frameworks?.join(', ') || '' },
        { category: 'Tools & Cloud', skills: data.tools?.join(', ') || '' },
        { category: 'Soft Skills', skills: data.soft?.join(', ') || '' },
      ].filter((g) => g.skills)
      setForm((f) => ({ ...f, skillGroups: newGroups.length ? newGroups : f.skillGroups }))
      toast.success('Skills auto-categorized!')
    } catch { toast.error('Categorization failed') }
    finally { setAutoCat(false) }
  }

  // ─── AI: Improve experience bullet ──────────────────────────────────────
  async function handleImproveExp(idx: number) {
    const desc = form.experience[idx]?.description
    if (!desc?.trim()) { toast.error('Write a description first'); return }
    setImprovingExp(idx)
    try {
      const res = await fetch('/api/candidate/improve-bullet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bullet: desc, targetRole: form.headline || 'Software Engineer' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      // Apply first improved option
      const updated = [...form.experience]
      updated[idx] = { ...updated[idx], description: data.improved?.[0] || desc }
      setForm((f) => ({ ...f, experience: updated }))
      toast.success('Bullet improved! Edit to customise.')
    } catch { toast.error('Improvement failed') }
    finally { setImprovingExp(null) }
  }

  // ─── AI: Enhance project bullets ────────────────────────────────────────
  async function handleEnhanceProject(idx: number) {
    const proj = form.projects[idx]
    if (!proj?.description?.trim()) { toast.error('Write a description first'); return }
    setImprovingProj(idx)
    try {
      const bullets = proj.description.split('\n').filter(Boolean)
      const res = await fetch('/api/candidate/enhance-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'project', items: bullets, projectName: proj.name, techStack: proj.techStack }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const updated = [...form.projects]
      updated[idx] = { ...updated[idx], description: (data.enhanced as string[]).join('\n') }
      setForm((f) => ({ ...f, projects: updated }))
      toast.success('Project bullets enhanced!')
    } catch { toast.error('Enhancement failed') }
    finally { setImprovingProj(null) }
  }

  // ─── AI: Enhance achievements ────────────────────────────────────────────
  async function handleEnhanceAchievements() {
    const items = form.achievements.filter((a) => a.trim())
    if (items.length === 0) { toast.error('Add achievements first'); return }
    setEnhancingAch(true)
    try {
      const res = await fetch('/api/candidate/enhance-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'achievements', items }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setForm((f) => ({ ...f, achievements: data.enhanced as string[] }))
      toast.success('Achievements enhanced!')
    } catch { toast.error('Enhancement failed') }
    finally { setEnhancingAch(false) }
  }

  // ─── ATS Check ───────────────────────────────────────────────────────────
  async function runAtsCheck() {
    if (!jd.trim()) { toast.error('Paste a job description first'); return }
    setAtsChecking(true); setAtsResult(null)
    try {
      const res = await fetch('/api/candidate/ats-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: jd }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAtsResult(data)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'ATS check failed') }
    finally { setAtsChecking(false) }
  }

  // ─── PDF Export ──────────────────────────────────────────────────────────
  async function downloadPDF() {
    setDownloading(true)
    try {
      const res = await fetch('/api/candidate/export-resume')
      if (!res.ok) {
        let msg = 'Export failed'
        try { const d = await res.json(); msg = d.error || msg } catch { /* non-JSON error body */ }
        throw new Error(msg)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'resume.pdf'; a.click()
      URL.revokeObjectURL(url)
      toast.success('Resume downloaded!')
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Download failed') }
    finally { setDownloading(false) }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="min-h-screen"><Navbar />
      <div className="flex justify-center py-40"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>
    </div>
  )

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-8">

        {/* Header */}
        <Link href="/candidate/profile" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to profile
        </Link>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-violet-400" /> Resume Builder
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">Build, optimise, and export your resume.</p>
          </div>
          {tab === 'build' && (
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Resume
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 glass rounded-xl p-1">
          {([
            { id: 'build', label: 'Build', icon: FileText },
            { id: 'ats', label: 'ATS Check', icon: BarChart3 },
            { id: 'export', label: 'Export PDF', icon: Download },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${
                tab === id ? 'bg-violet-600 text-white' : 'text-muted-foreground hover:text-foreground'
              }`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {/* ══════════════════════ BUILD TAB ══════════════════════ */}
        {tab === 'build' && (
          <>
            {/* Contact */}
            <SectionCard title="Contact Information">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Field label="Full Name">
                  <input className={input} value={form.name} placeholder="Manglam Jaiswal"
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </Field>
                <Field label="Phone">
                  <input className={input} value={form.phone} placeholder="+91 9876543210"
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Field label="Headline / Target Role">
                  <input className={input} value={form.headline} placeholder="IoT Security Engineer"
                    onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))} />
                </Field>
                <Field label="Location">
                  <input className={input} value={form.location} placeholder="Mumbai, India"
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { key: 'github', label: 'GitHub URL', ph: 'github.com/username' },
                  { key: 'linkedin', label: 'LinkedIn URL', ph: 'linkedin.com/in/username' },
                  { key: 'portfolio', label: 'Portfolio / Website', ph: 'yoursite.com' },
                  { key: 'tryhackme', label: 'TryHackMe URL (optional)', ph: 'tryhackme.com/p/username' },
                ] as const).map(({ key, label, ph }) => (
                  <Field key={key} label={label}>
                    <input className={input} value={form[key]} placeholder={ph}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                  </Field>
                ))}
              </div>
            </SectionCard>

            {/* Summary */}
            <SectionCard title="Professional Summary">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">3 sentences that sell you.</span>
                <AiBtn onClick={handleGenSummary} loading={genSummary} label="Generate with AI" />
              </div>
              <textarea className={textarea} rows={4} value={form.bio}
                placeholder="Experienced Electronics & CS engineer specialising in cybersecurity and IoT systems…"
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
            </SectionCard>

            {/* Education */}
            <SectionCard title="Education">
              <p className="text-xs text-muted-foreground mb-3">Add rows in chronological order (latest first).</p>
              <div className="space-y-3">
                {form.education.map((edu, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/3 p-4 relative">
                    <button onClick={() => setForm((f) => ({ ...f, education: f.education.filter((_, x) => x !== i) }))}
                      className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <Field label="Degree / Programme">
                        <input className={input} value={edu.degree} placeholder="B.E. Electronics & Computer Science"
                          onChange={(e) => { const ed = [...form.education]; ed[i] = { ...ed[i], degree: e.target.value }; setForm((f) => ({ ...f, education: ed })) }} />
                      </Field>
                      <Field label="Institution">
                        <input className={input} value={edu.institution} placeholder="Fr. CRCE, Bandra"
                          onChange={(e) => { const ed = [...form.education]; ed[i] = { ...ed[i], institution: e.target.value }; setForm((f) => ({ ...f, education: ed })) }} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Year / Status">
                        <input className={input} value={edu.year} placeholder="Pursuing / 2025"
                          onChange={(e) => { const ed = [...form.education]; ed[i] = { ...ed[i], year: e.target.value }; setForm((f) => ({ ...f, education: ed })) }} />
                      </Field>
                      <Field label="CGPA / Percentage">
                        <input className={input} value={edu.cgpa} placeholder="8.19/10 or 70%"
                          onChange={(e) => { const ed = [...form.education]; ed[i] = { ...ed[i], cgpa: e.target.value }; setForm((f) => ({ ...f, education: ed })) }} />
                      </Field>
                      <Field label="Honours / Field (optional)">
                        <input className={input} value={edu.field} placeholder="Cybersecurity"
                          onChange={(e) => { const ed = [...form.education]; ed[i] = { ...ed[i], field: e.target.value }; setForm((f) => ({ ...f, education: ed })) }} />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setForm((f) => ({ ...f, education: [...f.education, { degree: '', institution: '', year: '', cgpa: '', field: '' }] }))}
                className="mt-3 flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300">
                <Plus className="h-4 w-4" /> Add row
              </button>
            </SectionCard>

            {/* Technical Skills */}
            <SectionCard title="Technical Skills">
              {/* Step 1 — flat entry */}
              <Field label="All your skills (comma-separated)">
                <textarea className={`${textarea} mb-1`} rows={3}
                  value={form.flatSkills}
                  placeholder="React, Node.js, Python, Docker, AWS, Figma, MongoDB, Git…"
                  onChange={(e) => setForm((f) => ({ ...f, flatSkills: e.target.value }))} />
              </Field>
              <div className="flex items-center justify-between mt-2 mb-4">
                <p className="text-xs text-muted-foreground">Click to group skills into categories automatically.</p>
                <AiBtn onClick={handleAutoCategorize} loading={autoCat} label="Auto-categorize" />
              </div>

              {/* Step 2 — categorised rows (populated by AI or manually) */}
              {form.skillGroups.length > 0 && (
                <>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Categorised groups (edit freely)</p>
                  <div className="flex gap-2 mb-1 px-0.5">
                    <span className="w-40 shrink-0 text-xs text-muted-foreground">Category</span>
                    <span className="flex-1 text-xs text-muted-foreground">Skills</span>
                  </div>
                  <div className="space-y-2">
                    {form.skillGroups.map((g, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input className={input} style={{ width: '10rem', flexShrink: 0 }} value={g.category} placeholder="e.g. Languages"
                          onChange={(e) => { const sg = [...form.skillGroups]; sg[i] = { ...sg[i], category: e.target.value }; setForm((f) => ({ ...f, skillGroups: sg })) }} />
                        <input className={`${input} flex-1`} value={g.skills} placeholder="Python, JavaScript, Go"
                          onChange={(e) => { const sg = [...form.skillGroups]; sg[i] = { ...sg[i], skills: e.target.value }; setForm((f) => ({ ...f, skillGroups: sg })) }} />
                        <button onClick={() => setForm((f) => ({ ...f, skillGroups: f.skillGroups.filter((_, x) => x !== i) }))}
                          className="text-muted-foreground hover:text-foreground shrink-0"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <button onClick={() => setForm((f) => ({ ...f, skillGroups: [...f.skillGroups, { category: '', skills: '' }] }))}
                className="mt-3 flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300">
                <Plus className="h-4 w-4" /> Add category row manually
              </button>
            </SectionCard>

            {/* Experience */}
            <SectionCard title="Experience">
              <p className="text-xs text-muted-foreground mb-3">
                Enter each bullet on a <strong>new line</strong>. Click <Sparkles className="h-3 w-3 inline text-violet-400" /> to rewrite in STAR format.
              </p>
              <div className="space-y-4">
                {form.experience.map((exp, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/3 p-4 relative">
                    <button onClick={() => setForm((f) => ({ ...f, experience: f.experience.filter((_, x) => x !== i) }))}
                      className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <Field label="Job Title">
                        <input className={input} value={exp.title} placeholder="IoT Programming Engineer Intern"
                          onChange={(e) => { const ex = [...form.experience]; ex[i] = { ...ex[i], title: e.target.value }; setForm((f) => ({ ...f, experience: ex })) }} />
                      </Field>
                      <Field label="Company">
                        <input className={input} value={exp.company} placeholder="NCC Telecom Pvt. Ltd., Mumbai"
                          onChange={(e) => { const ex = [...form.experience]; ex[i] = { ...ex[i], company: e.target.value }; setForm((f) => ({ ...f, experience: ex })) }} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <Field label="Start Date">
                        <input className={input} value={exp.startDate} placeholder="Dec 2025"
                          onChange={(e) => { const ex = [...form.experience]; ex[i] = { ...ex[i], startDate: e.target.value }; setForm((f) => ({ ...f, experience: ex })) }} />
                      </Field>
                      <Field label="End Date">
                        <input className={input} value={exp.endDate} placeholder="Feb 2026 (or leave blank if current)"
                          disabled={exp.current}
                          onChange={(e) => { const ex = [...form.experience]; ex[i] = { ...ex[i], endDate: e.target.value }; setForm((f) => ({ ...f, experience: ex })) }} />
                      </Field>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground mb-2 cursor-pointer">
                      <input type="checkbox" checked={exp.current}
                        onChange={(e) => { const ex = [...form.experience]; ex[i] = { ...ex[i], current: e.target.checked }; setForm((f) => ({ ...f, experience: ex })) }} />
                      Currently working here
                    </label>
                    <Field label="Bullet Points (one per line)">
                      <div className="relative">
                        <textarea className={`${textarea} pr-28`} rows={4} value={exp.description}
                          placeholder={"Programmed IoT devices for smart home systems.\nAssisted installation and troubleshooting across client sites."}
                          onChange={(e) => { const ex = [...form.experience]; ex[i] = { ...ex[i], description: e.target.value }; setForm((f) => ({ ...f, experience: ex })) }} />
                        <button onClick={() => handleImproveExp(i)} disabled={improvingExp === i}
                          className="absolute top-2 right-2 flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-xs text-violet-300 hover:bg-violet-500/20 transition-colors disabled:opacity-50">
                          {improvingExp === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          Improve
                        </button>
                      </div>
                    </Field>
                  </div>
                ))}
              </div>
              <button onClick={() => setForm((f) => ({ ...f, experience: [...f.experience, { title: '', company: '', startDate: '', endDate: '', current: false, description: '' }] }))}
                className="mt-3 flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300">
                <Plus className="h-4 w-4" /> Add experience
              </button>
            </SectionCard>

            {/* Projects */}
            <SectionCard title="Projects">
              <p className="text-xs text-muted-foreground mb-3">Enter bullets one per line. Click <Sparkles className="h-3 w-3 inline text-violet-400" /> to enhance.</p>
              <div className="space-y-4">
                {form.projects.map((proj, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/3 p-4 relative">
                    <button onClick={() => setForm((f) => ({ ...f, projects: f.projects.filter((_, x) => x !== i) }))}
                      className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <Field label="Project Name">
                        <input className={input} value={proj.name} placeholder="PWDGuard — Password Security Suite"
                          onChange={(e) => { const pr = [...form.projects]; pr[i] = { ...pr[i], name: e.target.value }; setForm((f) => ({ ...f, projects: pr })) }} />
                      </Field>
                      <Field label="GitHub / Live URL (optional)">
                        <input className={input} value={proj.url} placeholder="github.com/user/project"
                          onChange={(e) => { const pr = [...form.projects]; pr[i] = { ...pr[i], url: e.target.value }; setForm((f) => ({ ...f, projects: pr })) }} />
                      </Field>
                    </div>
                    <Field label="Tech Stack (comma-separated)">
                      <input className={`${input} mb-2`} value={proj.techStack} placeholder="Python, Chrome Extension, REST API"
                        onChange={(e) => { const pr = [...form.projects]; pr[i] = { ...pr[i], techStack: e.target.value }; setForm((f) => ({ ...f, projects: pr })) }} />
                    </Field>
                    <Field label="Bullet Points (one per line)">
                      <div className="relative">
                        <textarea className={`${textarea} pr-28`} rows={3} value={proj.description}
                          placeholder={"Built a desktop app to evaluate password strength and detect breaches.\nDeveloped a Chrome extension for secure auto-fill."}
                          onChange={(e) => { const pr = [...form.projects]; pr[i] = { ...pr[i], description: e.target.value }; setForm((f) => ({ ...f, projects: pr })) }} />
                        <button onClick={() => handleEnhanceProject(i)} disabled={improvingProj === i}
                          className="absolute top-2 right-2 flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-xs text-violet-300 hover:bg-violet-500/20 transition-colors disabled:opacity-50">
                          {improvingProj === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          Enhance
                        </button>
                      </div>
                    </Field>
                  </div>
                ))}
              </div>
              <button onClick={() => setForm((f) => ({ ...f, projects: [...f.projects, { name: '', url: '', techStack: '', description: '' }] }))}
                className="mt-3 flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300">
                <Plus className="h-4 w-4" /> Add project
              </button>
            </SectionCard>

            {/* Certifications */}
            <SectionCard title="Certifications">
              <div className="space-y-2">
                {form.certifications.map((cert, i) => (
                  <div key={i} className="flex gap-2">
                    <input className={`${input} flex-1`} value={cert.title} placeholder="TryHackMe Pre Security"
                      onChange={(e) => { const c = [...form.certifications]; c[i] = { ...c[i], title: e.target.value }; setForm((f) => ({ ...f, certifications: c })) }} />
                    <input className={`${input} flex-1`} value={cert.url} placeholder="Certificate URL (optional)"
                      onChange={(e) => { const c = [...form.certifications]; c[i] = { ...c[i], url: e.target.value }; setForm((f) => ({ ...f, certifications: c })) }} />
                    <button onClick={() => setForm((f) => ({ ...f, certifications: f.certifications.filter((_, x) => x !== i) }))}
                      className="text-muted-foreground hover:text-foreground shrink-0"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setForm((f) => ({ ...f, certifications: [...f.certifications, { title: '', url: '' }] }))}
                className="mt-3 flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300">
                <Plus className="h-4 w-4" /> Add certification
              </button>
            </SectionCard>

            {/* Achievements */}
            <SectionCard title="Achievements">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">One achievement per line — rankings, awards, CTF placements, etc.</p>
                <AiBtn onClick={handleEnhanceAchievements} loading={enhancingAch} label="Enhance All" />
              </div>
              <div className="space-y-2">
                {form.achievements.map((ach, i) => (
                  <div key={i} className="flex gap-2">
                    <input className={`${input} flex-1`} value={ach}
                      placeholder="Ranked in Top 4% on TryHackMe global cybersecurity platform"
                      onChange={(e) => { const a = [...form.achievements]; a[i] = e.target.value; setForm((f) => ({ ...f, achievements: a })) }} />
                    <button onClick={() => setForm((f) => ({ ...f, achievements: f.achievements.filter((_, x) => x !== i) }))}
                      className="text-muted-foreground hover:text-foreground shrink-0"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setForm((f) => ({ ...f, achievements: [...f.achievements, ''] }))}
                className="mt-3 flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300">
                <Plus className="h-4 w-4" /> Add achievement
              </button>
            </SectionCard>

            <button onClick={handleSave} disabled={saving}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Resume
            </button>
          </>
        )}

        {/* ══════════════════════ ATS CHECK TAB ══════════════════════ */}
        {tab === 'ats' && (
          <div className="glass rounded-2xl p-6 gradient-border">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-5 w-5 text-violet-400" />
              <h2 className="font-semibold">ATS Score Checker</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-5">
              Paste a job description below. AI compares it against your saved profile and surfaces keyword gaps.
            </p>

            <div className="relative mb-4">
              <ClipboardPaste className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              <textarea rows={7} value={jd} onChange={(e) => setJd(e.target.value)}
                placeholder="Paste the job description here…"
                className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all resize-none placeholder:text-muted-foreground" />
            </div>
            <div className="flex gap-3">
              <button onClick={runAtsCheck} disabled={atsChecking || !jd.trim()}
                className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors">
                {atsChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {atsChecking ? 'Analysing…' : 'Check ATS Score'}
              </button>
              {atsResult && (
                <button onClick={() => { setAtsResult(null); setJd('') }}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                  <RefreshCw className="h-4 w-4" /> Reset
                </button>
              )}
            </div>

            {atsResult && (
              <div className="mt-6 space-y-5">
                <div className="flex flex-col sm:flex-row items-center gap-6 glass rounded-xl p-5">
                  <ScoreRing score={atsResult.atsScore} />
                  <div className="flex-1 text-center sm:text-left">
                    <p className={`text-xl font-bold ${atsResult.atsScore >= 70 ? 'text-green-400' : atsResult.atsScore >= 45 ? 'text-amber-400' : 'text-red-400'}`}>
                      {atsResult.atsScore >= 70 ? 'Strong match' : atsResult.atsScore >= 45 ? 'Moderate match' : 'Needs improvement'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">ATS Compatibility Score</p>
                    <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{atsResult.feedback}</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="glass rounded-xl p-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                      <span className="text-sm font-medium text-green-400">Matched ({atsResult.matchedKeywords.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {atsResult.matchedKeywords.map((kw) => (
                        <span key={kw} className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/30">
                          <CheckCircle2 className="h-3 w-3" />{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="glass rounded-xl p-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <XCircle className="h-4 w-4 text-red-400" />
                      <span className="text-sm font-medium text-red-400">Missing ({atsResult.missingKeywords.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {atsResult.missingKeywords.map((kw) => (
                        <span key={kw} className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30">
                          <XCircle className="h-3 w-3" />{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {atsResult.missingKeywords.length > 0 && (
                  <div className="rounded-xl border border-violet-500/20 bg-violet-500/8 p-4 text-xs">
                    <p className="text-violet-300 font-medium mb-1 flex items-center gap-1"><Tags className="h-3.5 w-3.5" /> Tip</p>
                    <p className="text-muted-foreground leading-relaxed">
                      Add the missing keywords to your <strong className="text-foreground">Skills</strong> section if you genuinely have them.
                      Then use the <strong className="text-foreground">Improve</strong> button on your experience bullets to naturally include them.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════ EXPORT TAB ══════════════════════ */}
        {tab === 'export' && (
          <div className="glass rounded-2xl p-6 gradient-border">
            <div className="flex items-center gap-2 mb-1">
              <Download className="h-5 w-5 text-violet-400" />
              <h2 className="font-semibold">Export Resume as PDF</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-5">
              Downloads a clean, ATS-friendly PDF in the standard resume format — matching the layout you defined in the Build tab.
            </p>

            <div className="mb-6 rounded-xl border border-white/8 bg-white/3 p-4 space-y-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground text-sm mb-3 flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-amber-400" /> PDF Format Includes
              </p>
              {[
                'Header: Name · Phone · Email · All links',
                'Professional Summary',
                'Education table (Degree | Institution | Year | CGPA)',
                'Technical Skills (two-column: category | skills)',
                'Experience with date-aligned bullets',
                'Projects with tech stack and GitHub links',
                'Certifications (clickable links)',
                'Achievements',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-3 text-xs text-amber-300 mb-5">
              Save your resume in the <strong>Build</strong> tab first before downloading.
            </div>

            <button onClick={downloadPDF} disabled={downloading}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloading ? 'Generating PDF…' : 'Download Resume PDF'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
