'use client'

import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Briefcase, Loader2 } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })

  // Role-selection modal state (shown for brand-new Google users)
  const [pendingToken, setPendingToken] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<'candidate' | 'recruiter'>('candidate')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await signIn('credentials', {
      email: form.email,
      password: form.password,
      redirect: false,
    })
    setLoading(false)
    if (res?.error) {
      toast.error('Invalid email or password')
    } else {
      router.push(callbackUrl)
    }
  }

  async function handleFirebaseGoogle() {
    setGoogleLoading(true)
    try {
      // Dynamically import Firebase to keep initial bundle small
      const { signInWithPopup } = await import('firebase/auth')
      const { firebaseAuth, googleProvider } = await import('@/lib/firebase')

      const result = await signInWithPopup(firebaseAuth, googleProvider)
      const idToken = await result.user.getIdToken()
      const email = result.user.email ?? ''

      // Check if this user already exists in our DB
      const check = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`)
      const { exists } = await check.json()

      if (exists) {
        // Existing user — sign in directly
        await completeFirebaseSignIn(idToken, null)
      } else {
        // New user — show role selector before creating account
        setPendingToken(idToken)
        setGoogleLoading(false)
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? ''
      const msg = (err as { message?: string })?.message ?? ''
      console.error('Firebase Google sign-in error:', code, msg)

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // User closed popup — silent
      } else if (code === 'auth/popup-blocked') {
        toast.error('Popup was blocked. Please allow popups for this site and try again.')
      } else if (code === 'auth/unauthorized-domain') {
        toast.error('This domain is not authorized in Firebase. Add localhost to Firebase Console → Authentication → Settings → Authorized domains.')
      } else if (code === 'auth/operation-not-allowed') {
        toast.error('Google sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method → Google.')
      } else if (code === 'auth/configuration-not-found') {
        toast.error('Firebase Authentication is not configured. Enable Google provider in Firebase Console.')
      } else {
        toast.error(`Google sign-in failed: ${code || msg || 'Unknown error'}`)
      }
      setGoogleLoading(false)
    }
  }

  async function completeFirebaseSignIn(token: string, role: string | null) {
    setGoogleLoading(true)
    const res = await signIn('credentials', {
      firebaseToken: token,
      role: role ?? 'candidate',
      redirect: false,
    })
    setGoogleLoading(false)
    if (res?.error) {
      toast.error('Sign-in failed. Please try again.')
      setPendingToken(null)
    } else {
      router.push(callbackUrl)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">NexusHire</span>
          </Link>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to your account</p>
        </div>

        <div className="glass rounded-2xl p-8">
          {/* Google sign-in via Firebase */}
          <button
            onClick={handleFirebaseGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10 transition-colors mb-6 disabled:opacity-60"
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {googleLoading ? 'Signing in…' : 'Continue with Google'}
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs text-muted-foreground px-2">
              or sign in with email
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-violet-400 hover:text-violet-300 font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>

      {/* Role selection modal — shown for brand-new Google users */}
      {pendingToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass rounded-2xl p-8 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-2">One last step</h2>
            <p className="text-sm text-muted-foreground mb-6">How will you use NexusHire?</p>

            <div className="flex gap-3 mb-6">
              {(['candidate', 'recruiter'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedRole(r)}
                  className={`flex-1 rounded-xl border py-3 text-sm font-medium capitalize transition-all ${
                    selectedRole === r
                      ? 'border-violet-500 bg-violet-500/15 text-violet-300'
                      : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
                  }`}
                >
                  {r === 'candidate' ? '🎯 Find Jobs' : '🏢 Hire Talent'}
                  <span className="block text-xs mt-0.5 font-normal opacity-70 capitalize">{r}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => completeFirebaseSignIn(pendingToken, selectedRole)}
              disabled={googleLoading}
              className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {googleLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Continue as {selectedRole}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
