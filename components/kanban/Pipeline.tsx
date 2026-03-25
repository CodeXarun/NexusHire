'use client'

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import { useState } from 'react'
import { scoreColor, scoreBg, timeAgo } from '@/lib/utils'
import { Zap } from 'lucide-react'

export interface PipelineApplication {
  _id: string
  stage: string
  outcome?: string
  matchScore: number
  percentileRank?: number
  createdAt: string
  resumeS3Key?: string
  candidate?: {
    name: string
    email: string
    headline?: string
    image?: string
    resumeS3Key?: string
  }
}

const STAGES = [
  { id: 'applied', label: 'Applied', color: 'border-blue-500/30' },
  { id: 'under_review', label: 'Under Review', color: 'border-yellow-500/30' },
  { id: 'shortlisted', label: 'Shortlisted', color: 'border-green-500/30' },
  { id: 'interview', label: 'Interview', color: 'border-purple-500/30' },
  { id: 'decision', label: 'Decision', color: 'border-orange-500/30' },
  { id: 'outcome', label: 'Outcome', color: 'border-gray-500/30' },
]

const MEDALS = ['🥇', '🥈', '🥉']

function ApplicationCard({
  app, isDragging = false, medal, selected, onSelect,
}: {
  app: PipelineApplication
  isDragging?: boolean
  medal?: string
  selected?: boolean
  onSelect?: (id: string, checked: boolean) => void
}) {
  return (
    <div className={`rounded-xl border bg-white/5 p-3 ${isDragging ? 'opacity-50 rotate-2 shadow-2xl shadow-violet-500/20' : 'hover:bg-white/8 transition-colors'} ${selected ? 'border-violet-500/60 bg-violet-500/8' : 'border-white/10'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {onSelect && (
            <input
              type="checkbox"
              checked={!!selected}
              onChange={(e) => { e.stopPropagation(); onSelect(app._id, e.target.checked) }}
              onClick={(e) => e.stopPropagation()}
              className="h-3.5 w-3.5 rounded accent-violet-500 shrink-0 cursor-pointer"
            />
          )}
          {app.candidate?.image ? (
            <img src={app.candidate.image} alt="" className="h-7 w-7 rounded-full shrink-0" />
          ) : (
            <div className="h-7 w-7 rounded-full bg-violet-600/30 flex items-center justify-center text-xs font-bold text-violet-400 shrink-0">
              {app.candidate?.name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div className="min-w-0 flex flex-col items-start">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-medium truncate">{app.candidate?.name || 'Unknown'}</p>
              {medal && <span className="text-sm shrink-0">{medal}</span>}
              {app.outcome === 'hired' && <span className="text-[10px] uppercase tracking-wider font-bold bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-sm">Hired</span>}
              {app.outcome === 'rejected' && <span className="text-[10px] uppercase tracking-wider font-bold bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-sm">Rejected</span>}
            </div>
            {app.candidate?.headline && (
              <p className="text-xs text-muted-foreground truncate">{app.candidate.headline}</p>
            )}
          </div>
        </div>
        {app.matchScore !== undefined && (
          <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold shrink-0 ${scoreBg(app.matchScore)} ${scoreColor(app.matchScore)}`}>
            <Zap className="h-2.5 w-2.5" />
            {app.matchScore}%
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{timeAgo(app.createdAt)}</p>
    </div>
  )
}

function DroppableColumn({
  stage,
  apps,
  onCardClick,
  topRankedIds,
  selectedIds,
  onSelect,
}: {
  stage: typeof STAGES[0]
  apps: PipelineApplication[]
  onCardClick: (app: PipelineApplication) => void
  topRankedIds: string[]
  selectedIds: string[]
  onSelect: (id: string, checked: boolean) => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.id })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl border ${stage.color} bg-white/3 p-3 min-h-48 transition-colors ${isOver ? 'bg-white/8' : ''}`}
      style={{ minWidth: 200 }}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-sm font-semibold">{stage.label}</span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-muted-foreground">{apps.length}</span>
      </div>
      <div className="flex flex-col gap-2 flex-1">
        {apps.map((app) => {
          const rank = topRankedIds.indexOf(app._id)
          return (
            <DraggableCard
              key={app._id}
              app={app}
              onCardClick={onCardClick}
              medal={rank >= 0 ? MEDALS[rank] : undefined}
              selected={selectedIds.includes(app._id)}
              onSelect={onSelect}
            />
          )
        })}
      </div>
    </div>
  )
}

function DraggableCard({
  app, onCardClick, medal, selected, onSelect,
}: {
  app: PipelineApplication
  onCardClick: (app: PipelineApplication) => void
  medal?: string
  selected?: boolean
  onSelect?: (id: string, checked: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: app._id })

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      {...attributes}
      {...listeners}
      onClick={() => onCardClick(app)}
      className="cursor-grab active:cursor-grabbing"
    >
      <ApplicationCard app={app} isDragging={isDragging} medal={medal} selected={selected} onSelect={onSelect} />
    </div>
  )
}

interface PipelineProps {
  applications: PipelineApplication[]
  onStageChange: (applicationId: string, newStage: string) => Promise<void>
  onCardClick: (app: PipelineApplication) => void
  topRankedIds?: string[]
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
}

export function Pipeline({ applications, onStageChange, onCardClick, topRankedIds = [], selectedIds = [], onSelectionChange }: PipelineProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const grouped = STAGES.reduce<Record<string, PipelineApplication[]>>((acc, s) => {
    acc[s.id] = applications.filter((a) => a.stage === s.id)
    return acc
  }, {})

  const activeApp = activeId ? applications.find((a) => a._id === activeId) : null

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id))
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over || active.id === over.id) return

    const app = applications.find((a) => a._id === active.id)
    const newStage = String(over.id)
    if (!app || !STAGES.find((s) => s.id === newStage) || app.stage === newStage) return

    await onStageChange(String(active.id), newStage)
  }

  function handleSelect(id: string, checked: boolean) {
    if (!onSelectionChange) return
    const next = checked ? [...selectedIds, id] : selectedIds.filter((s) => s !== id)
    onSelectionChange(next)
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <DroppableColumn
            key={stage.id}
            stage={stage}
            apps={grouped[stage.id] || []}
            onCardClick={onCardClick}
            topRankedIds={topRankedIds}
            selectedIds={selectedIds}
            onSelect={handleSelect}
          />
        ))}
      </div>
      <DragOverlay>
        {activeApp && <ApplicationCard app={activeApp} />}
      </DragOverlay>
    </DndContext>
  )
}
