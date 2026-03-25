'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'
import { useState } from 'react'
import logoImg from '@/components/public/nexushirelogo.png'
import { Menu, X, LogOut, LayoutDashboard, Users, Building2, Network, FileText } from 'lucide-react'

export function Navbar() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)

  const role = session?.user?.role
  const dashPath = role === 'candidate' ? '/candidate/dashboard' : '/recruiter/dashboard'
  const logoPath = session
    ? role === 'candidate'
      ? '/candidate/profile/settings'
      : '/recruiter/profile/settings'
    : '/'

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href={logoPath} className="flex items-center gap-2">
            {/* <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600"> */}
              <Image
                src={logoImg}
                alt="NexusHire"
                width={32}
                height={32}
                className="h-8 w-8 rounded-xl object-contain"
              />
            {/* // </div> */}
            <span className="text-lg font-bold gradient-text">NexusHire</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/jobs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Browse Jobs
            </Link>
            {session ? (
              <>
                <Link href={dashPath} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
                {role === 'candidate' && (
                  <>
                    <Link href="/candidate/opportunity-graph" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                      <Network className="h-4 w-4" />
                      Opportunity Graph
                    </Link>
                    <Link href="/candidate/resume-builder" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      Resume Tools
                    </Link>
                  </>
                )}
                {role === 'recruiter' && (
                  <>
                    <Link href="/recruiter/candidates" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      Candidates
                    </Link>
                    <Link href="/recruiter/profile" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      Company
                    </Link>
                  </>
                )}
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
                <Link href={logoPath} aria-label="Profile settings" className="flex items-center gap-2">
                  {session.user.image ? (
                    <img src={session.user.image} alt="" className="h-8 w-8 rounded-full" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
                      {session.user.name?.[0]?.toUpperCase()}
                    </div>
                  )}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
                >
                  Get started
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden" onClick={() => setOpen(!open)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-white/10 bg-background/95 backdrop-blur px-4 py-4 space-y-3">
          <Link href="/jobs" className="block text-sm" onClick={() => setOpen(false)}>Browse Jobs</Link>
          {session ? (
            <>
              <Link href={dashPath} className="block text-sm" onClick={() => setOpen(false)}>Dashboard</Link>
              {role === 'candidate' && (
                <>
                  <Link href="/candidate/opportunity-graph" className="block text-sm" onClick={() => setOpen(false)}>Opportunity Graph</Link>
                  <Link href="/candidate/resume-builder" className="block text-sm" onClick={() => setOpen(false)}>Resume Tools</Link>
                </>
              )}
              <button onClick={() => signOut({ callbackUrl: '/' })} className="block text-sm text-muted-foreground">Sign out</button>
            </>
          ) : (
            <>
              <Link href="/login" className="block text-sm" onClick={() => setOpen(false)}>Sign in</Link>
              <Link href="/register" className="block text-sm" onClick={() => setOpen(false)}>Get started</Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
