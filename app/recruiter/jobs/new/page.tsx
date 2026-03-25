'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { toast } from 'sonner'
import { Loader2, Plus, X, ArrowLeft, Sparkles, CheckCircle } from 'lucide-react'
import Link from 'next/link'

interface Skill { skill: string; weight: 1 | 2 | 3; type: 'technical' | 'soft' | 'domain' | 'tool' }

interface AIPreview {
  requiredSkills: Skill[]
  experienceRange: { min: number; max: number }
  roleLevel: string
  cultureTags: string[]
  salaryRange?: { min: number; max: number; currency: string }
  locationType?: string
}

export default function NewJobPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    locationType: 'hybrid' as 'remote' | 'onsite' | 'hybrid',
    employmentType: 'full-time' as 'full-time' | 'part-time' | 'contract' | 'internship',
    roleLevel: 'mid' as 'junior' | 'mid' | 'senior' | 'lead' | 'executive',
    experienceRange: { min: 0, max: 5 },
    salaryRange: { min: 0, max: 0, currency: 'USD' },
    requiredSkills: [] as Skill[],
    status: 'active' as 'draft' | 'active',
  })
  const [aiPreview, setAiPreview] = useState<AIPreview | null>(null)
  const [previewApplied, setPreviewApplied] = useState(false)

  const extract = useMutation({
    mutationFn: () =>
      fetch('/api/jobs/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: form.description }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      setAiPreview(data)
      setPreviewApplied(false)
      toast.success('AI extracted job entity — review and apply below')
    },
    onError: () => toast.error('AI extraction failed'),
  })

  function applyPreview() {
    if (!aiPreview) return
    setForm((f) => ({
      ...f,
      requiredSkills: aiPreview.requiredSkills?.length ? aiPreview.requiredSkills : f.requiredSkills,
      experienceRange: aiPreview.experienceRange ?? f.experienceRange,
      roleLevel: (aiPreview.roleLevel as typeof f.roleLevel) ?? f.roleLevel,
      locationType: (aiPreview.locationType as typeof f.locationType) ?? f.locationType,
      salaryRange: aiPreview.salaryRange ?? f.salaryRange,
    }))
    setPreviewApplied(true)
    toast.success('AI suggestions applied to form')
  }

  const create = useMutation({
    mutationFn: () =>
      fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }).then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(d.error))
        return r.json()
      }),
    onSuccess: (data) => {
      toast.success('Job posted! AI is generating skill embeddings…')
      router.push(`/recruiter/jobs/${data._id}/pipeline`)
    },
    onError: (e: string) => toast.error(e || 'Failed to create job'),
  })

  function addSkill() {
    setForm({ ...form, requiredSkills: [...form.requiredSkills, { skill: '', weight: 2, type: 'technical' }] })
  }
  function removeSkill(i: number) {
    setForm({ ...form, requiredSkills: form.requiredSkills.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/recruiter/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Post a new job</h1>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending || !form.title}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Post job
          </button>
        </div>

        {/* Basic */}
        <div className="glass rounded-2xl p-6 mb-6 gradient-border space-y-4">
          <h2 className="font-semibold">Job Details</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Job title *</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Senior React Developer"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              rows={6}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the role, responsibilities, and what makes it exciting. AI will extract skills automatically."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all resize-none"
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">AI will auto-extract skills from your description.</p>
              <button
                type="button"
                onClick={() => extract.mutate()}
                disabled={extract.isPending || !form.description.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 px-3 py-1.5 text-xs text-violet-300 hover:bg-violet-500/25 disabled:opacity-40 transition-colors"
              >
                {extract.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {extract.isPending ? 'Extracting…' : 'AI Extract'}
              </button>
            </div>
          </div>

          {/* AI Preview */}
          {aiPreview && (
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/8 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-400" />
                  <span className="text-sm font-medium text-violet-300">AI Extracted Entity</span>
                </div>
                {!previewApplied ? (
                  <button
                    onClick={applyPreview}
                    className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 transition-colors"
                  >
                    <CheckCircle className="h-3 w-3" />
                    Apply to form
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <CheckCircle className="h-3 w-3" /> Applied
                  </span>
                )}
              </div>
              <div className="space-y-2 text-xs">
                {aiPreview.requiredSkills?.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Skills: </span>
                    <span className="text-foreground">{aiPreview.requiredSkills.map((s) => s.skill).join(', ')}</span>
                  </div>
                )}
                {aiPreview.experienceRange && (
                  <div>
                    <span className="text-muted-foreground">Experience: </span>
                    <span className="text-foreground">{aiPreview.experienceRange.min}–{aiPreview.experienceRange.max} years</span>
                  </div>
                )}
                {aiPreview.roleLevel && (
                  <div>
                    <span className="text-muted-foreground">Level: </span>
                    <span className="capitalize text-foreground">{aiPreview.roleLevel}</span>
                  </div>
                )}
                {aiPreview.cultureTags?.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Culture: </span>
                    <span className="text-foreground">{aiPreview.cultureTags.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Location</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="New York, NY"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Work type</label>
              <select
                value={form.locationType}
                onChange={(e) => setForm({ ...form, locationType: e.target.value as typeof form.locationType })}
                className="w-full rounded-xl border border-white/10 bg-[hsl(0,0%,6%)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
              >
                <option value="remote">Remote</option>
                <option value="onsite">On-site</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Employment type</label>
              <select
                value={form.employmentType}
                onChange={(e) => setForm({ ...form, employmentType: e.target.value as typeof form.employmentType })}
                className="w-full rounded-xl border border-white/10 bg-[hsl(0,0%,6%)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
              >
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Level</label>
              <select
                value={form.roleLevel}
                onChange={(e) => setForm({ ...form, roleLevel: e.target.value as typeof form.roleLevel })}
                className="w-full rounded-xl border border-white/10 bg-[hsl(0,0%,6%)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
              >
                <option value="junior">Junior</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
                <option value="executive">Executive</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Salary min (USD)</label>
              <input
                type="number"
                value={form.salaryRange.min || ''}
                onChange={(e) => setForm({ ...form, salaryRange: { ...form.salaryRange, min: +e.target.value } })}
                placeholder="80000"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Salary max (USD)</label>
              <input
                type="number"
                value={form.salaryRange.max || ''}
                onChange={(e) => setForm({ ...form, salaryRange: { ...form.salaryRange, max: +e.target.value } })}
                placeholder="120000"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="glass rounded-2xl p-6 mb-6 gradient-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Required Skills</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Add manually or use "AI Extract" above</p>
            </div>
            <button onClick={addSkill} className="flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300">
              <Plus className="h-4 w-4" /> Add skill
            </button>
          </div>
          <div className="space-y-2">
            {form.requiredSkills.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={s.skill}
                  onChange={(e) => {
                    const skills = [...form.requiredSkills]
                    skills[i] = { ...skills[i], skill: e.target.value }
                    setForm({ ...form, requiredSkills: skills })
                  }}
                  placeholder="e.g. TypeScript"
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
                />
                <select
                  value={s.weight}
                  onChange={(e) => {
                    const skills = [...form.requiredSkills]
                    skills[i] = { ...skills[i], weight: +e.target.value as 1 | 2 | 3 }
                    setForm({ ...form, requiredSkills: skills })
                  }}
                  className="rounded-xl border border-white/10 bg-[hsl(0,0%,6%)] px-2 py-2 text-sm focus:outline-none"
                >
                  <option value={1}>Nice to have</option>
                  <option value={2}>Important</option>
                  <option value={3}>Required</option>
                </select>
                <select
                  value={s.type}
                  onChange={(e) => {
                    const skills = [...form.requiredSkills]
                    skills[i] = { ...skills[i], type: e.target.value as typeof s.type }
                    setForm({ ...form, requiredSkills: skills })
                  }}
                  className="rounded-xl border border-white/10 bg-[hsl(0,0%,6%)] px-2 py-2 text-sm focus:outline-none"
                >
                  <option value="technical">Technical</option>
                  <option value="soft">Soft</option>
                  <option value="domain">Domain</option>
                  <option value="tool">Tool</option>
                </select>
                <button onClick={() => removeSkill(i)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {form.requiredSkills.length === 0 && (
              <p className="text-sm text-muted-foreground">No skills added. AI will extract them from your description.</p>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="glass rounded-2xl p-6 gradient-border">
          <h2 className="font-semibold mb-4">Publishing</h2>
          <div className="flex gap-3">
            {(['draft', 'active'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setForm({ ...form, status: s })}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-medium capitalize transition-all ${
                  form.status === s
                    ? 'border-violet-500 bg-violet-500/15 text-violet-300'
                    : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
                }`}
              >
                {s === 'draft' ? '📝 Save as draft' : '🚀 Publish now'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
