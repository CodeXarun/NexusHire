'use client'

import { useEffect, useRef, Component, type ReactNode } from 'react'

// ── Error boundary — swallows WebGL crashes from the Spline viewer ────────────
class SplineErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false }
  static getDerivedStateFromError() { return { crashed: true } }
  componentDidCatch() { /* silently ignore */ }
  render() {
    if (this.state.crashed) return null
    return this.props.children
  }
}

// ── Check WebGL availability before mounting ──────────────────────────────────
function webGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(
      canvas.getContext('webgl') ||
      canvas.getContext('webgl2') ||
      canvas.getContext('experimental-webgl')
    )
  } catch (_) {
    return false
  }
}

function SplineScene() {
  const containerRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Skip entirely if WebGL is unavailable — avoids the unhandled runtime error
    if (!webGLAvailable()) return

    // ── Load Spline viewer web-component script ──────────────────────────
    if (!document.querySelector('script[data-spline-viewer]')) {
      const script = document.createElement('script')
      script.type = 'module'
      script.src = 'https://unpkg.com/@splinetool/viewer/build/spline-viewer.js'
      script.dataset.splineViewer = '1'
      document.head.appendChild(script)
    }

    // ── Mount spline-viewer ───────────────────────────────────────────────
    const container = containerRef.current
    if (container && !container.querySelector('spline-viewer')) {
      const viewer = document.createElement('spline-viewer')
      viewer.setAttribute('url', 'https://prod.spline.design/ejW1o3P1DuyDzFwT/scene.splinecode')
      viewer.setAttribute('loading', 'lazy')
      viewer.style.cssText = [
        'position:absolute',
        'left:-8%',
        'top:-16%',
        'width:116%',
        'height:116%',
        'pointer-events:auto',
      ].join(';')
      container.appendChild(viewer)
    }

    // ── Cursor glow ───────────────────────────────────────────────────────
    const glow = glowRef.current
    let raf = 0
    let mx = 0, my = 0

    const onMove = (e: MouseEvent) => {
      mx = e.clientX; my = e.clientY
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (!glow) return
        glow.style.transform = `translate(${mx - 250}px, ${my - 250}px)`
        glow.style.opacity = '1'
      })
    }
    const onLeave = () => { if (glow) glow.style.opacity = '0' }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      {/* Cursor glow orb */}
      <div
        ref={glowRef}
        style={{
          position: 'fixed', top: 0, left: 0, width: 500, height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.22) 0%, rgba(109,40,217,0.08) 45%, transparent 70%)',
          pointerEvents: 'none', zIndex: 9999, opacity: 0,
          transition: 'opacity 0.4s ease', willChange: 'transform',
        }}
      />

      {/* Spline container */}
      <div className="absolute inset-0 overflow-hidden">
        <div ref={containerRef} className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-background/90" style={{ pointerEvents: 'none' }} />
        <div className="absolute inset-0 bg-gradient-to-r from-background/35 via-transparent to-background/35" style={{ pointerEvents: 'none' }} />
      </div>
    </>
  )
}

export function SplineBackground() {
  return (
    <SplineErrorBoundary>
      <SplineScene />
    </SplineErrorBoundary>
  )
}
