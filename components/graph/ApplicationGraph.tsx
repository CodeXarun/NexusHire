'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false })

// ── Public types ──────────────────────────────────────────────────────────────
export interface GraphNode {
  id: string
  type: 'job' | 'candidate'
  label: string
  score?: number
  stage?: string
}

export interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  score: number
  stage: string
}

export interface OverlapLink {
  source: string
  target: string
  sharedSkills: string[]
}

interface ApplicationGraphProps {
  nodes: GraphNode[]
  links: GraphLink[]
  overlapLinks?: OverlapLink[]
  width?: number
  height?: number
  onNodeClick?: (node: GraphNode) => void
}

// ── Stage colours / labels (outside JSX to avoid as-const / TSX parse issues) ─
const STAGE_COLORS: Record<string, string> = {
  applied:      '#60a5fa',
  under_review: '#facc15',
  shortlisted:  '#34d399',
  interview:    '#a78bfa',
  decision:     '#fb923c',
  outcome:      '#9ca3af',
}

const STAGE_LABELS: Record<string, string> = {
  applied:      'Applied',
  under_review: 'Under Review',
  shortlisted:  'Shortlisted',
  interview:    'Interview',
  decision:     'Decision',
  outcome:      'Outcome',
}

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
export function ApplicationGraph({
  nodes,
  links,
  overlapLinks = [],
  height = 620,
  onNodeClick,
}: ApplicationGraphProps) {
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
    fg.d3Force('charge')?.strength?.(-900)
    fg.d3Force('link')?.distance?.(360).strength?.(0.28)
    fg.d3ReheatSimulation()
  }, [nodes.length])

  // Pull camera to a comfortable zoom once simulation settles
  const handleEngineStop = useCallback(() => {
    fgRef.current?.cameraPosition({ x: 0, y: 0, z: 400 }, { x: 0, y: 0, z: 0 }, 1000)
  }, [])

  // ── Graph data ──────────────────────────────────────────────────────────
  const mainLinks = links.map((l) => ({
    ...l,
    source: typeof l.source === 'string' ? l.source : l.source.id,
    target: typeof l.target === 'string' ? l.target : l.target.id,
    linkType: 'main',
  }))

  const overlapAsLinks = overlapLinks.map((ol) => ({
    source: ol.source, target: ol.target,
    score: 0, stage: 'overlap',
    sharedSkills: ol.sharedSkills,
    linkType: 'overlap',
  }))

  const graphData = {
    nodes: nodes.map((n) => ({ ...n })),
    links: [...mainLinks, ...overlapAsLinks],
  }

  // Stages present in data → used to build legend
  const usedStages = [...new Set(links.map((l) => l.stage).filter((s) => STAGE_LABELS[s]))]

  // ── Custom node object ────────────────────────────────────────────────
  const nodeThreeObject = useCallback((node: Record<string, unknown>) => {
    const isJob = node.type === 'job'
    const score = (node.score as number) ?? 0
    const stage = (node.stage as string) ?? ''
    const radius = isJob ? 16 : 6 + score / 9
    const hexColor = isJob ? '#7c3aed' : (STAGE_COLORS[stage] ?? scoreHex(score))

    const group = new THREE.Group()

    // Sphere
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(radius, 28, 28),
      new THREE.MeshLambertMaterial({
        color: new THREE.Color(hexColor),
        transparent: true,
        opacity: isJob ? 0.95 : 0.88,
      }),
    ))

    // Outer ring for job node
    if (isJob) {
      group.add(new THREE.Mesh(
        new THREE.TorusGeometry(radius + 5, 0.8, 10, 56),
        new THREE.MeshBasicMaterial({ color: '#a78bfa', transparent: true, opacity: 0.5 }),
      ))
    }

    // Score badge above candidate nodes
    if (!isJob) {
      const badge = makeSprite(`${score}%`, scoreHex(score), 22)
      badge.position.set(0, radius + 12, 0)
      group.add(badge)
    }

    // Name label below node
    const rawLabel = node.label as string
    const displayName = rawLabel.length > 20 ? rawLabel.slice(0, 18) + '…' : rawLabel
    const nameSprite = makeSprite(
      isJob ? `💼 ${displayName}` : displayName,
      isJob ? '#c4b5fd' : '#e2e8f0',
      isJob ? 24 : 20,
    )
    nameSprite.position.set(0, -(radius + 12), 0)
    group.add(nameSprite)

    // Stage label below candidate name
    if (!isJob && stage && STAGE_LABELS[stage]) {
      const stageSprite = makeSprite(STAGE_LABELS[stage], STAGE_COLORS[stage] ?? '#9ca3af', 16)
      stageSprite.position.set(0, -(radius + 28), 0)
      group.add(stageSprite)
    }

    return group
  }, [])

  // ── Link / node helpers ───────────────────────────────────────────────
  const linkColor = useCallback((link: Record<string, unknown>) => {
    if (link.linkType === 'overlap') return 'rgba(251,191,36,0.2)'
    return (STAGE_COLORS[link.stage as string] ?? '#6366f1') + 'cc'
  }, [])

  const linkWidth = useCallback((link: Record<string, unknown>) => {
    if (link.linkType === 'overlap') return 0.5
    return 1 + (link.score as number) / 50
  }, [])

  const particleSpeed = useCallback((link: Record<string, unknown>) =>
    link.linkType === 'main' ? 0.005 : 0, [])

  const nodeVal = useCallback((node: Record<string, unknown>) =>
    node.type === 'job' ? 36 : 6 + ((node.score as number) ?? 0) / 10, [])

  // Pin node at dropped position so it doesn't spring back
  const handleNodeDragEnd = useCallback((node: Record<string, unknown>) => {
    node.fx = node.x
    node.fy = node.y
    node.fz = node.z
  }, [])

  const handleClick = useCallback((node: Record<string, unknown>) =>
    onNodeClick?.(node as unknown as GraphNode), [onNodeClick])

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
        linkDirectionalArrowLength={5}
        linkDirectionalArrowRelPos={1}
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

      {/* Stage legend */}
      {usedStages.length > 0 && (
        <div className="absolute top-4 left-4 flex flex-col gap-2 rounded-xl border border-white/10 bg-black/60 backdrop-blur-md px-4 py-3">
          <p className="text-[10px] font-semibold text-white/50 uppercase tracking-widest mb-1">Pipeline Stage</p>
          {usedStages.map((stage) => (
            <div key={stage} className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: STAGE_COLORS[stage] }} />
              <span className="text-xs text-white/75">{STAGE_LABELS[stage]}</span>
            </div>
          ))}
          <div className="flex items-center gap-2.5 mt-1 pt-2 border-t border-white/10">
            <span className="h-3 w-3 rounded-full flex-shrink-0 bg-violet-500" />
            <span className="text-xs text-white/75">Job posting</span>
          </div>
        </div>
      )}

      {/* Hint */}
      <div className="absolute bottom-4 right-4 rounded-lg border border-white/10 bg-black/60 backdrop-blur-md px-3 py-1.5">
        <p className="text-[11px] text-white/40">Drag · Scroll to zoom · Click node</p>
      </div>
    </div>
  )
}
