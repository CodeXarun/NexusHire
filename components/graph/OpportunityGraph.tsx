'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false })

// ── Public types ──────────────────────────────────────────────────────────────
export interface JobNode {
  id: string
  title: string
  companyName: string
  location: string
  score: number
  employmentType?: string
  locationType?: string
  requiredSkills?: Array<{ skill: string; weight: number }>
}

interface OpportunityGraphProps {
  jobs: JobNode[]
  candidateName: string
  selectedJobId?: string | null
  onJobClick?: (job: JobNode) => void
  height?: number
}

// ── Legend data (outside JSX to avoid as-const / TSX parse issues) ────────────
const LEGEND = [
  { col: '#22c55e', label: '≥ 75%  Strong match' },
  { col: '#f59e0b', label: '50–74%  Good match' },
  { col: '#ef4444', label: '< 50%  Weak match' },
  { col: '#7c3aed', label: 'You (candidate)' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function scoreHex(score: number) {
  if (score >= 75) return '#22c55e'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

function makeSprite(text: string, color: string, fontSize = 24): THREE.Sprite {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const px = fontSize * 2
  ctx.font = `600 ${px}px Inter,system-ui,sans-serif`
  const tw = ctx.measureText(text).width
  canvas.width = tw + 28
  canvas.height = px + 18
  ctx.font = `600 ${px}px Inter,system-ui,sans-serif`
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 14, canvas.height / 2)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  const aspect = canvas.width / canvas.height
  sprite.scale.set(aspect * 12, 12, 1)
  return sprite
}

// ── Component ─────────────────────────────────────────────────────────────────
export function OpportunityGraph({
  jobs,
  candidateName,
  selectedJobId,
  onJobClick,
  height = 640,
}: OpportunityGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null)
  const [width, setWidth] = useState(900)

  useEffect(() => {
    if (!containerRef.current) return
    setWidth(containerRef.current.offsetWidth)
    const ro = new ResizeObserver(() => {
      if (containerRef.current) setWidth(containerRef.current.offsetWidth)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Boost repulsion + link distance so nodes spread out properly
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    fg.d3Force('charge')?.strength?.(-800)
    fg.d3Force('link')?.distance?.(350).strength?.(0.3)
    fg.d3ReheatSimulation()
  }, [jobs.length]) // re-apply when node count changes

  // Pull camera to a comfortable zoom once simulation settles
  const handleEngineStop = useCallback(() => {
    fgRef.current?.cameraPosition({ x: 0, y: 0, z: 380 }, { x: 0, y: 0, z: 0 }, 1000)
  }, [])

  // ── Graph data ──────────────────────────────────────────────────────────
  const nodes = [
    { id: '__candidate__', type: 'candidate', label: candidateName, score: 100 },
    ...jobs.map((j) => ({
      id: j.id, type: 'job', label: j.title,
      company: j.companyName, score: j.score, requiredSkills: j.requiredSkills,
    })),
  ]

  const mainLinks = jobs.map((j) => ({
    source: '__candidate__', target: j.id, score: j.score, linkType: 'main',
  }))

  const clusterLinks: { source: string; target: string; score: number; linkType: string }[] = []
  for (let i = 0; i < jobs.length; i++) {
    const setA = new Set((jobs[i].requiredSkills || []).map((s) => s.skill.toLowerCase()))
    for (let k = i + 1; k < jobs.length; k++) {
      const shared = (jobs[k].requiredSkills || []).filter((s) => setA.has(s.skill.toLowerCase())).length
      if (shared >= 2) clusterLinks.push({ source: jobs[i].id, target: jobs[k].id, score: 0, linkType: 'cluster' })
    }
  }

  const graphData = { nodes, links: [...mainLinks, ...clusterLinks] }

  // ── Custom node object ────────────────────────────────────────────────
  const nodeThreeObject = useCallback((node: Record<string, unknown>) => {
    const isCandidate = node.type === 'candidate'
    const score = (node.score as number) ?? 0
    const radius = isCandidate ? 16 : 6 + score / 9
    const hexColor = isCandidate ? '#7c3aed' : (node.id === selectedJobId ? '#c4b5fd' : scoreHex(score))

    const group = new THREE.Group()

    // Sphere
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 28, 28),
      new THREE.MeshLambertMaterial({
        color: new THREE.Color(hexColor),
        transparent: true,
        opacity: isCandidate ? 0.95 : 0.88,
      }),
    )
    group.add(sphere)

    // Outer ring on candidate
    if (isCandidate) {
      group.add(new THREE.Mesh(
        new THREE.TorusGeometry(radius + 5, 0.8, 10, 56),
        new THREE.MeshBasicMaterial({ color: '#a78bfa', transparent: true, opacity: 0.5 }),
      ))
    }

    // Score badge above node (jobs)
    if (!isCandidate) {
      const badge = makeSprite(`${score}%`, scoreHex(score), 22)
      badge.position.set(0, radius + 12, 0)
      group.add(badge)
    }

    // Name label below node
    const rawLabel = node.label as string
    const displayName = isCandidate
      ? `👤 ${rawLabel}`
      : rawLabel.length > 20 ? rawLabel.slice(0, 18) + '…' : rawLabel
    const nameSprite = makeSprite(displayName, isCandidate ? '#c4b5fd' : '#e2e8f0', isCandidate ? 24 : 20)
    nameSprite.position.set(0, -(radius + 12), 0)
    group.add(nameSprite)

    // Company label even further below (jobs)
    if (!isCandidate && node.company) {
      const comp = node.company as string
      const compSprite = makeSprite(
        comp.length > 20 ? comp.slice(0, 18) + '…' : comp,
        '#64748b', 16,
      )
      compSprite.position.set(0, -(radius + 28), 0)
      group.add(compSprite)
    }

    return group
  }, [selectedJobId])

  // ── Link / node helpers ───────────────────────────────────────────────
  const linkColor = useCallback((link: Record<string, unknown>) => {
    if (link.linkType === 'cluster') return 'rgba(139,92,246,0.18)'
    return scoreHex(link.score as number) + 'aa'
  }, [])

  const linkWidth = useCallback((link: Record<string, unknown>) => {
    if (link.linkType === 'cluster') return 0.5
    return 1 + (link.score as number) / 50
  }, [])

  const particleSpeed = useCallback((link: Record<string, unknown>) =>
    link.linkType === 'main' ? 0.004 : 0, [])

  const nodeVal = useCallback((node: Record<string, unknown>) =>
    node.type === 'candidate' ? 36 : 6 + (node.score as number) / 10, [])

  // Pin node at dropped position so it doesn't spring back
  const handleNodeDragEnd = useCallback((node: Record<string, unknown>) => {
    node.fx = node.x
    node.fy = node.y
    node.fz = node.z
  }, [])

  const handleClick = useCallback((node: Record<string, unknown>) => {
    if (node.type === 'job') {
      const job = jobs.find((j) => j.id === node.id)
      if (job) onJobClick?.(job)
    }
  }, [jobs, onJobClick])

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-2xl overflow-hidden border border-white/10"
      style={{ height, background: 'linear-gradient(135deg,#0d0d1a 0%,#0f0a1e 60%,#0a0d1a 100%)' }}
    >
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        width={width}
        height={height}
        backgroundColor="rgba(0,0,0,0)"
        showNavInfo={false}
        nodeThreeObject={nodeThreeObject}
        nodeVal={nodeVal}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkDirectionalParticles={3}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleSpeed={particleSpeed}
        onNodeClick={handleClick}
        onNodeDragEnd={handleNodeDragEnd}
        onEngineStop={handleEngineStop}
        warmupTicks={80}
        cooldownTicks={120}
        d3AlphaDecay={0.012}
        d3VelocityDecay={0.25}
      />

      {/* Legend */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 rounded-xl border border-white/10 bg-black/60 backdrop-blur-md px-4 py-3">
        <p className="text-[10px] font-semibold text-white/50 uppercase tracking-widest mb-1">Match Score</p>
        {LEGEND.map((item) => (
          <div key={item.label} className="flex items-center gap-2.5">
            <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: item.col }} />
            <span className="text-xs text-white/75">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Hint */}
      <div className="absolute bottom-4 right-4 rounded-lg border border-white/10 bg-black/60 backdrop-blur-md px-3 py-1.5">
        <p className="text-[11px] text-white/40">Drag · Scroll to zoom · Click node</p>
      </div>
    </div>
  )
}
