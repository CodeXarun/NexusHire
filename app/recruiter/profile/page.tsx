'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Navbar } from '@/components/Navbar'
import { Loader2, Save, Building2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']
const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Education', 'Retail',
  'Manufacturing', 'Media', 'Real Estate', 'Consulting', 'Other',
]

interface CompanyForm {
  companyName: string
  industry: string
  size: string
  website: string
  description: string
}

export default function RecruiterProfilePage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CompanyForm>({
    companyName: '', industry: '', size: '', website: '', description: '',
  })

  const { data, isLoading } = useQuery<Partial<CompanyForm>>({
    queryKey: ['recruiter-profile'],
    queryFn: () => fetch('/api/recruiter/profile').then((r) => r.json()),
  })

  useEffect(() => {
    if (data && data.companyName !== undefined) {
      setForm({
        companyName: data.companyName || '',
        industry: data.industry || '',
        size: data.size || '',
        website: data.website || '',
        description: data.description || '',
      })
    }
  }, [data])

  const save = useMutation({
    mutationFn: () =>
      fetch('/api/recruiter/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruiter-profile'] })
      toast.success('Company profile saved')
    },
    onError: () => toast.error('Failed to save profile'),
  })

  return (
    <div className="min-h-screen">
      <Navbar />
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>
      ) : (
        <div className="mx-auto max-w-2xl px-4 py-10">
          <Link href="/recruiter/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>

          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold">Company Profile</h1>
              <p className="text-muted-foreground mt-1">Shown to candidates on your job listings</p>
              <Link
                href="/recruiter/profile/settings"
                className="block mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Profile Settings →
              </Link>
            </div>
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.companyName}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          </div>

          <div className="glass rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-violet-600/20 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-violet-400" />
              </div>
              <h2 className="font-semibold">Company Details</h2>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Company name *</label>
              <input
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder="Acme Corp"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Industry</label>
                <select
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[hsl(0,0%,6%)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
                >
                  <option value="">Select industry</option>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Company size</label>
                <select
                  value={form.size}
                  onChange={(e) => setForm({ ...form, size: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[hsl(0,0%,6%)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
                >
                  <option value="">Select size</option>
                  {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s} employees</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Website</label>
              <input
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://acme.com"
                type="url"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">About the company</label>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Tell candidates what makes your company a great place to work…"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all resize-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
