'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Navbar } from '@/components/Navbar'
import { toast } from 'sonner'
import { Loader2, Phone, MapPin, Github, Linkedin, Globe, Sparkles, Image as ImageIcon, Upload } from 'lucide-react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

type CandidateSettingsForm = {
  phone: string
  location: string
  github: string
  linkedin: string
  portfolio: string
}

export default function CandidateProfileSettingsPage() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['candidate-profile'],
    queryFn: () => fetch('/api/candidate/profile').then((r) => r.json()),
  })

  const [form, setForm] = useState<CandidateSettingsForm>({
    phone: '',
    location: '',
    github: '',
    linkedin: '',
    portfolio: '',
  })

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadPhotoPending, setUploadPhotoPending] = useState(false)

  useEffect(() => {
    if (!profile) return
    setForm({
      phone: String(profile.phone || ''),
      location: String(profile.location || ''),
      github: String(profile.githubUrl || ''),
      linkedin: String(profile.linkedinUrl || ''),
      portfolio: String(profile.portfolioUrl || ''),
    })
  }, [profile])

  useEffect(() => {
    // Initial preview comes from the current session avatar
    setPhotoPreview(session?.user?.image ? String(session.user.image) : null)
  }, [session?.user?.image])

  const save = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error('Profile not loaded')

      // The candidate PUT endpoint recalculates embedding/strength based on headline/bio/skills/etc,
      // so we send the full existing profile back along with only the editable settings fields.
      const payload = {
        headline: profile.headline || '',
        bio: profile.bio || '',
        location: form.location,
        phone: form.phone,
        skills: profile.skills || [],
        skillGroups: profile.skillGroups || [],
        experience: profile.experience || [],
        education: profile.education || [],
        projects: profile.projects || [],
        certifications: profile.certifications || [],
        achievements: profile.achievements || [],
        socialLinks: {
          github: form.github,
          linkedin: form.linkedin,
          portfolio: form.portfolio,
        },
      }

      const r = await fetch('/api/candidate/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return r.json()
    },
    onSuccess: () => {
      toast.success('Settings saved!')
      queryClient.invalidateQueries({ queryKey: ['candidate-profile'] })
    },
    onError: () => {
      toast.error('Failed to save settings')
    },
  })

  async function uploadPhoto() {
    if (!photoFile) {
      toast.error('Select a profile photo first')
      return
    }
    setUploadPhotoPending(true)
    try {
      const fd = new FormData()
      fd.append('photo', photoFile)

      const r = await fetch('/api/user/photo', { method: 'POST', body: fd })
      const contentType = r.headers.get('content-type') || ''
      const data = contentType.includes('application/json') ? await r.json() : { error: await r.text() }
      if (!r.ok) throw new Error(data?.error || 'Failed to upload')

      toast.success('Profile photo updated')
      // Session avatar is driven by JWT/session; easiest is refresh page so Navbar gets new image.
      window.location.reload()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload photo')
    } finally {
      setUploadPhotoPending(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link
          href="/candidate/profile"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          Back to profile
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Profile Settings</h1>
            <p className="text-muted-foreground mt-1">Update contact info and public links.</p>
          </div>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Save
          </button>
        </div>

        <div className="glass rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="font-semibold mb-4">Profile Photo</h2>
            <div className="flex items-start gap-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-xl overflow-hidden bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoPreview} alt="Profile photo" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-violet-400" />
                  )}
                </div>
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    setPhotoFile(file)
                    if (file) setPhotoPreview(URL.createObjectURL(file))
                  }}
                  className="block w-full text-sm file:mr-4 file:rounded-xl file:border-0 file:bg-violet-600/20 file:px-4 file:py-2.5 file:text-violet-300 hover:file:bg-violet-600/30"
                />
                <p className="mt-2 text-xs text-muted-foreground">Max 2MB. The avatar will update in the header.</p>
                <button
                  type="button"
                  onClick={uploadPhoto}
                  disabled={uploadPhotoPending}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
                >
                  {uploadPhotoPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Upload Photo
                </button>
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-semibold mb-4">Contact</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-violet-400" />
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="e.g. +91 98765 43210"
                    type="tel"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Optional. Used for your resume/contact.</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-violet-400" />
                  <input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="Mumbai, India"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-semibold mb-4">Public Links</h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">GitHub</label>
                <div className="relative">
                  <Github className="absolute left-3 top-3 h-4 w-4 text-violet-400" />
                  <input
                    value={form.github}
                    onChange={(e) => setForm({ ...form, github: e.target.value })}
                    placeholder="https://github.com/username"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">LinkedIn</label>
                <div className="relative">
                  <Linkedin className="absolute left-3 top-3 h-4 w-4 text-violet-400" />
                  <input
                    value={form.linkedin}
                    onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Portfolio</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3 h-4 w-4 text-violet-400" />
                  <input
                    value={form.portfolio}
                    onChange={(e) => setForm({ ...form, portfolio: e.target.value })}
                    placeholder="https://your-site.com"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
                  />
                </div>
              </div>

            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-muted-foreground">
            These settings update your public contact and links. Your skills/experience remain unchanged.
          </div>
        </div>
      </div>
    </div>
  )
}

