import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { SplineBackground } from '@/components/SplineBackground'
import { ArrowRight, Brain, Network, Search, Zap, BarChart3, MessageSquare } from 'lucide-react'

const features = [
  {
    icon: Brain,
    title: 'AI-Powered Matching',
    desc: 'NVIDIA NIM embeddings + Groq LLM score every candidate against every role with full skill breakdown.',
  },
  {
    icon: Network,
    title: 'Application Graph',
    desc: 'D3.js force-directed network shows the entire talent pipeline — every node a person, every edge an application.',
  },
  {
    icon: Search,
    title: 'Intent-Based Search',
    desc: 'Type naturally. AI extracts skills, location, salary range, and role level from plain English.',
  },
  {
    icon: Zap,
    title: 'Real-Time Tracking',
    desc: 'Pusher WebSockets push stage updates to candidates the instant recruiters move their card.',
  },
  {
    icon: BarChart3,
    title: 'Compatibility Radar',
    desc: 'Radar chart visualizes skill alignment across every dimension — technical, soft, domain, tools.',
  },
  {
    icon: MessageSquare,
    title: 'AI Interview Simulator',
    desc: 'Practice role-specific interviews. Get scored answers and a full debrief report powered by Groq.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden py-24 lg:py-32">
        {/* Spline 3D background */}
        <SplineBackground />

        <div className="relative z-10 mx-auto max-w-7xl px-4 text-center">
          {/* <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-300">
            <Zap className="h-3.5 w-3.5" />
            Powered by Groq + NVIDIA NIM
          </div> */}

          <h1 className="mt-6 text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Hire and get hired
            <br />
            <span className="gradient-text">at the speed of AI</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            NexusHire uses large language models and semantic embeddings to match candidates
            and jobs — with full transparency into why every score looks the way it does.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register?role=candidate"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-600/20 hover:bg-violet-700 transition-all hover:scale-105"
            >
              Find your next role
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/register?role=recruiter"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 text-base font-semibold text-white hover:bg-white/10 transition-all hover:scale-105"
            >
              Post a job
            </Link>
          </div>

          {/* Glow beneath the buttons */}
          <div className="pointer-events-none flex justify-center" style={{ marginTop: '-4px' }}>
            {/* tight bright core */}
            <div style={{
              position: 'absolute',
              width: '420px',
              height: '60px',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.4) 40%, transparent 70%)',
              filter: 'blur(10px)',
            }} />
            {/* mid spread */}
            <div style={{
              position: 'absolute',
              width: '480px',
              height: '50px',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.25) 0%, rgba(200,190,255,0.12) 50%, transparent 72%)',
              filter: 'blur(18px)',
            }} />
            {/* wide soft aura */}
            <div style={{
              width: '680px',
              height: '70px',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at center, rgba(180,170,255,0.15) 0%, transparent 68%)',
              filter: 'blur(28px)',
            }} />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Everything you need to make the match</h2>
            <p className="mt-4 text-muted-foreground">Six AI-powered tools working together in one platform.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="glass rounded-2xl p-6 glow-hover gradient-border">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20">
                  <Icon className="h-5 w-5 text-violet-400" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <div className="glass rounded-3xl p-12 glow gradient-border">
            <h2 className="text-3xl font-bold sm:text-4xl">Ready to transform your hiring?</h2>
            <p className="mt-4 text-muted-foreground">
              Join thousands of companies and candidates who trust NexusHire.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-violet-700 transition-all hover:scale-105"
              >
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/jobs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Browse jobs →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-bold gradient-text">NexusHire</span>
          <p className="text-xs text-muted-foreground">© 2026 NexusHire. Built by Team Ace of Roots.</p>
        </div>
      </footer>
    </div>
  )
}
