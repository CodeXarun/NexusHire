'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Navbar } from '@/components/Navbar'
import { toast } from 'sonner'
import {
  Loader2, Upload, Plus, X, Save, Sparkles, Wand2, Tags, FileText,
} from 'lucide-react'
import Link from 'next/link'

interface Skill { name: string; level: string }
interface Experience {
  title: string; company: string; startDate: string
  endDate: string; description: string; current: boolean
}
interface Education { degree: string; institution: string; field: string; year: number }

interface BulletModal {
  expIndex: number
  improved: string[]
  keywords: string[]
  feedback: string
}

interface SkillCategories {
  languages: string[]
  frameworks: string[]
  tools: string[]
  soft: string[]
}

const CATEGORY_LABELS: Record<keyof SkillCategories, string> = {
  languages: 'Languages',
  frameworks: 'Frameworks & Libraries',
  tools: 'Tools & Cloud',
  soft: 'Soft Skills',
}

const PROFICIENCY_OPTIONS = ['beginner', 'intermediate', 'advanced', 'expert']

export default function CandidateProfilePage() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['candidate-profile'],
    queryFn: () => fetch('/api/candidate/profile').then((r) => r.json()),
  })

  const [form, setForm] = useState({
    name: '',
    headline: '',
    bio: '',
    location: '',
    skills: [] as Skill[],
    experience: [] as Experience[],
    education: [] as Education[],
    github: '',
    linkedin: '',
    portfolio: '',
  })

  // AI state
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [categorizingSkills, setCategorizingSkills] = useState(false)
  const [skillCategories, setSkillCategories] = useState<SkillCategories | null>(null)
  const [bulletModal, setBulletModal] = useState<BulletModal | null>(null)
  const [improvingBullet, setImprovingBullet] = useState<number | null>(null) // expIndex
  const [resumeTips, setResumeTips] = useState<string[]>([])

  useEffect(() => {
    if (!profile || isLoading) return
    setForm({
      name: (profile.name as string) || (session?.user?.name ?? ''),
      headline: profile.headline || '',
      bio: profile.bio || '',
      location: profile.location || '',
      skills: (profile.skills || []).map((s: { skill?: string; name?: string; proficiency?: string; level?: string }) => ({
        name: s.skill || s.name || '',
        level: s.proficiency || s.level || 'intermediate',
      })),
      experience: profile.experience || [],
      education: profile.education || [],
      github: profile.githubUrl || '',
      linkedin: profile.linkedinUrl || '',
      portfolio: profile.portfolioUrl || '',
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  const save = useMutation({
    mutationFn: () =>
      fetch('/api/candidate/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          socialLinks: { github: form.github, linkedin: form.linkedin, portfolio: form.portfolio },
        }),
      }).then((r) => r.json()),
    onSuccess: () => {
      toast.success('Profile saved!')
      queryClient.invalidateQueries({ queryKey: ['candidate-profile'] })
    },
    onError: () => toast.error('Failed to save profile'),
  })

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('resume', file)
    try {
      const res = await fetch('/api/candidate/resume', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const parsed = data.parsed
      if (parsed) {
        setForm((prev) => ({
          ...prev,
          name: prev.name || parsed.name || '',
          headline: parsed.headline || prev.headline,
          location: parsed.location || prev.location,
          github: parsed.githubUrl || prev.github,
          linkedin: parsed.linkedinUrl || prev.linkedin,
          portfolio: parsed.portfolioUrl || prev.portfolio,
          skills: parsed.skills?.length
            ? parsed.skills.map((s: { skill: string; proficiency?: string }) => ({
                name: s.skill,
                level: s.proficiency || 'intermediate',
              }))
            : prev.skills,
          experience: parsed.experience?.length ? parsed.experience : prev.experience,
          education: parsed.education?.length ? parsed.education : prev.education,
        }))
      }
      if (data.improvementTips?.length) setResumeTips(data.improvementTips)
      toast.success('Resume uploaded & profile auto-filled! Click "Save changes" to confirm.')
      queryClient.invalidateQueries({ queryKey: ['candidate-profile'] })
    } catch {
      toast.error('Failed to upload resume')
    } finally {
      setUploading(false)
    }
  }

  // ── AI: Generate Summary ──────────────────────────────────────────────
  async function handleGenerateSummary() {
    setGeneratingSummary(true)
    try {
      const res = await fetch('/api/candidate/generate-summary', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setForm((prev) => ({ ...prev, bio: data.summary }))
      toast.success('Summary generated! Edit it to personalise.')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate summary')
    } finally {
      setGeneratingSummary(false)
    }
  }

  // ── AI: Categorize Skills ─────────────────────────────────────────────
  async function handleCategorizeSkills() {
    if (form.skills.length === 0) {
      toast.error('Add some skills first')
      return
    }
    setCategorizingSkills(true)
    try {
      const res = await fetch('/api/candidate/categorize-skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills: form.skills.map((s) => s.name).filter(Boolean) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSkillCategories(data)
      toast.success('Skills categorized!')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to categorize skills')
    } finally {
      setCategorizingSkills(false)
    }
  }

  // ── AI: Improve Bullet ────────────────────────────────────────────────
  async function handleImproveBullet(expIndex: number) {
    const desc = form.experience[expIndex]?.description
    if (!desc?.trim()) {
      toast.error('Write a description first')
      return
    }
    setImprovingBullet(expIndex)
    try {
      const res = await fetch('/api/candidate/improve-bullet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bullet: desc, targetRole: form.headline || 'Software Engineer' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setBulletModal({ expIndex, ...data })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to improve bullet')
    } finally {
      setImprovingBullet(null)
    }
  }

  function applyImprovedBullet(text: string) {
    if (bulletModal === null) return
    const experience = [...form.experience]
    experience[bulletModal.expIndex] = { ...experience[bulletModal.expIndex], description: text }
    setForm({ ...form, experience })
    setBulletModal(null)
    toast.success('Applied! Remember to save.')
  }

  function addSkill() {
    setForm({ ...form, skills: [...form.skills, { name: '', level: 'intermediate' }] })
  }
  function removeSkill(i: number) {
    setForm({ ...form, skills: form.skills.filter((_, idx) => idx !== i) })
    setSkillCategories(null)
  }

  function addExp() {
    setForm({
      ...form,
      experience: [
        ...form.experience,
        { title: '', company: '', startDate: '', endDate: '', description: '', current: false },
      ],
    })
  }
  function removeExp(i: number) {
    setForm({ ...form, experience: form.experience.filter((_, idx) => idx !== i) })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex justify-center py-40">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Edit Profile</h1>
            <Link
              href="/candidate/resume-builder"
              className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors mt-1"
            >
              <FileText className="h-3.5 w-3.5" />
              ATS Checker &amp; PDF Export →
            </Link>
            <Link
              href="/candidate/profile/settings"
              className="block mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Profile Settings →
            </Link>
          </div>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </button>
        </div>

        {/* Resume upload */}
        <div className="glass rounded-2xl p-6 mb-6 gradient-border">
          <h2 className="font-semibold mb-4">Resume</h2>
          <div className="flex items-center gap-4">
            {profile?.resumeUrl && (
              <a
                href={profile.resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-violet-400 hover:text-violet-300"
              >
                View current resume
              </a>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Uploading…' : 'Upload PDF'}
            </button>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleResumeUpload} />
            <p className="text-xs text-muted-foreground">PDF only. AI will auto-fill your profile.</p>
          </div>
          {resumeTips.length > 0 && (
            <div className="mt-4 rounded-xl border border-violet-500/30 bg-violet-500/8 p-4">
              <div className="flex items-center gap-2 mb-2 text-violet-300 text-sm font-medium">
                <Sparkles className="h-4 w-4" /> AI Resume Tips
              </div>
              <ul className="space-y-1.5">
                {resumeTips.map((tip, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="text-violet-400 shrink-0">{i + 1}.</span> {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {profile?.resumeImprovementTips?.length > 0 && resumeTips.length === 0 && (
            <div className="mt-4 rounded-xl border border-violet-500/30 bg-violet-500/8 p-4">
              <div className="flex items-center gap-2 mb-2 text-violet-300 text-sm font-medium">
                <Sparkles className="h-4 w-4" /> AI Resume Tips
              </div>
              <ul className="space-y-1.5">
                {profile.resumeImprovementTips.map((tip: string, i: number) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="text-violet-400 shrink-0">{i + 1}.</span> {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Basic info */}
        <div className="glass rounded-2xl p-6 mb-6 gradient-border">
          <h2 className="font-semibold mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Full name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Your full name"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Professional headline{' '}
                <span className="text-xs text-muted-foreground font-normal">(your job title / role)</span>
              </label>
              <input
                value={form.headline}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
                placeholder="Full-Stack Developer · 2 years exp"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
              />
            </div>

            {/* Bio with AI Generate */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium">
                  Professional Summary / Bio
                </label>
                <button
                  onClick={handleGenerateSummary}
                  disabled={generatingSummary}
                  className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-300 hover:bg-violet-500/20 transition-colors disabled:opacity-50"
                >
                  {generatingSummary
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Wand2 className="h-3 w-3" />}
                  {generatingSummary ? 'Generating…' : 'Generate with AI'}
                </button>
              </div>
              <textarea
                rows={4}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Tell employers about yourself… or click Generate with AI."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Location</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Mumbai, India"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'github' as const, label: 'GitHub URL' },
                { key: 'linkedin' as const, label: 'LinkedIn URL' },
                { key: 'portfolio' as const, label: 'Portfolio URL' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium mb-1.5 text-muted-foreground">{label}</label>
                  <input
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder="https://"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="glass rounded-2xl p-6 mb-6 gradient-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Skills</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCategorizeSkills}
                disabled={categorizingSkills || form.skills.length === 0}
                className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-300 hover:bg-violet-500/20 transition-colors disabled:opacity-50"
              >
                {categorizingSkills
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Tags className="h-3 w-3" />}
                {categorizingSkills ? 'Categorizing…' : 'Categorize with AI'}
              </button>
              <button
                onClick={addSkill}
                className="flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300"
              >
                <Plus className="h-4 w-4" /> Add skill
              </button>
            </div>
          </div>

          {/* Categorized view */}
          {skillCategories && (
            <div className="mb-4 rounded-xl border border-violet-500/20 bg-violet-500/8 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-violet-300 flex items-center gap-1.5">
                  <Tags className="h-3.5 w-3.5" /> AI Skill Categories
                </p>
                <button
                  onClick={() => setSkillCategories(null)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Dismiss
                </button>
              </div>
              <div className="space-y-2">
                {(Object.keys(skillCategories) as Array<keyof SkillCategories>).map((cat) => {
                  const items = skillCategories[cat]
                  if (items.length === 0) return null
                  return (
                    <div key={cat} className="flex gap-2 flex-wrap items-start">
                      <span className="text-xs text-muted-foreground shrink-0 w-32">
                        {CATEGORY_LABELS[cat]}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((sk) => (
                          <span
                            key={sk}
                            className="rounded-lg bg-white/8 px-2.5 py-0.5 text-xs text-foreground"
                          >
                            {sk}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {form.skills.map((skill, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={skill.name}
                  onChange={(e) => {
                    const skills = [...form.skills]
                    skills[i] = { ...skills[i], name: e.target.value }
                    setForm({ ...form, skills })
                    setSkillCategories(null)
                  }}
                  placeholder="e.g. React"
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
                />
                <select
                  value={skill.level}
                  onChange={(e) => {
                    const skills = [...form.skills]
                    skills[i] = { ...skills[i], level: e.target.value }
                    setForm({ ...form, skills })
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
                >
                  {PROFICIENCY_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                  ))}
                </select>
                <button
                  onClick={() => removeSkill(i)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {form.skills.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No skills added yet. Click &quot;Add skill&quot; or upload your resume.
              </p>
            )}
          </div>
        </div>

        {/* Experience */}
        <div className="glass rounded-2xl p-6 mb-6 gradient-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Experience</h2>
            <button
              onClick={addExp}
              className="flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
          <div className="space-y-4">
            {form.experience.map((exp, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/3 p-4 relative">
                <button
                  onClick={() => removeExp(i)}
                  className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input
                    value={exp.title}
                    onChange={(e) => {
                      const experience = [...form.experience]
                      experience[i] = { ...experience[i], title: e.target.value }
                      setForm({ ...form, experience })
                    }}
                    placeholder="Job title"
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
                  />
                  <input
                    value={exp.company}
                    onChange={(e) => {
                      const experience = [...form.experience]
                      experience[i] = { ...experience[i], company: e.target.value }
                      setForm({ ...form, experience })
                    }}
                    placeholder="Company"
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
                  />
                </div>

                {/* Description with Improve Bullet button */}
                <div className="relative">
                  <textarea
                    rows={2}
                    value={exp.description}
                    onChange={(e) => {
                      const experience = [...form.experience]
                      experience[i] = { ...experience[i], description: e.target.value }
                      setForm({ ...form, experience })
                    }}
                    placeholder="Describe your role and achievements…"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 pr-28 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all resize-none"
                  />
                  <button
                    onClick={() => handleImproveBullet(i)}
                    disabled={improvingBullet === i}
                    title="Improve with AI (STAR format)"
                    className="absolute top-2 right-2 flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-xs text-violet-300 hover:bg-violet-500/20 transition-colors disabled:opacity-50"
                  >
                    {improvingBullet === i
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <Sparkles className="h-3 w-3" />}
                    Improve
                  </button>
                </div>
              </div>
            ))}
            {form.experience.length === 0 && (
              <p className="text-sm text-muted-foreground">No experience added.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Bullet Improve Modal ───────────────────────────────────────── */}
      {bulletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[hsl(0,0%,6%)] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-400" />
                <h3 className="font-semibold">STAR Bullet Suggestions</h3>
              </div>
              <button
                onClick={() => setBulletModal(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {bulletModal.feedback && (
              <div className="mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-300">
                <span className="font-medium">What was weak: </span>{bulletModal.feedback}
              </div>
            )}

            <p className="text-xs text-muted-foreground mb-3">
              Click an option to apply it to your description:
            </p>

            <div className="space-y-2 mb-4">
              {bulletModal.improved.map((option, i) => (
                <button
                  key={i}
                  onClick={() => applyImprovedBullet(option)}
                  className="w-full text-left rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm hover:border-violet-500/50 hover:bg-violet-500/8 transition-all"
                >
                  <span className="text-xs text-violet-400 font-medium mr-2">Option {i + 1}</span>
                  {option}
                </button>
              ))}
            </div>

            {bulletModal.keywords.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">ATS Keywords added:</p>
                <div className="flex flex-wrap gap-1.5">
                  {bulletModal.keywords.map((kw) => (
                    <span
                      key={kw}
                      className="rounded-full bg-violet-500/15 border border-violet-500/30 px-2.5 py-0.5 text-xs text-violet-300"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
