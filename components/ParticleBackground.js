'use client'

import React, { useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Routes that are the "app" (not marketing) — the animated particle canvas must
// NOT run here: a constant-repaint canvas behind the dashboard causes jank.
const APP_ROUTES = /^\/(dashboard|admin|company|interview|assessment|skill-profile)(\/|$)/

export default function ParticleBackground() {
  const canvasRef = useRef(null)
  const pathname = usePathname()
  const isApp = APP_ROUTES.test(pathname || '')

  useEffect(() => {
    if (isApp) return // no animation loop on app routes
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let particles = []
    let animationFrameId

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width
        this.y = Math.random() * canvas.height
        this.size = Math.random() * 2.5 + 1 // Increased size
        this.speedX = Math.random() * 0.8 - 0.4
        this.speedY = Math.random() * 0.8 - 0.4
        // Indigo/blue tones, opaque enough to read clearly on a white background.
        this.hue = 225 + Math.random() * 40
        this.color = `hsla(${this.hue}, 75%, 55%, ${Math.random() * 0.3 + 0.45})`
      }

      update(mouse) {
        this.x += this.speedX
        this.y += this.speedY

        if (this.x > canvas.width) this.x = 0
        if (this.x < 0) this.x = canvas.width
        if (this.y > canvas.height) this.y = 0
        if (this.y < 0) this.y = canvas.height

        const dx = mouse.x - this.x
        const dy = mouse.y - this.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance < 250) {
          const force = (250 - distance) / 250
          this.x += dx * force * 0.04
          this.y += dy * force * 0.04
        }
      }

      draw() {
        ctx.fillStyle = this.color
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const init = () => {
      particles = []
      // Density tuned so the O(n²) connect() pass stays smooth at 60fps.
      const numberOfParticles = Math.min(180, (canvas.width * canvas.height) / 11000)
      for (let i = 0; i < numberOfParticles; i++) {
        particles.push(new Particle())
      }
    }

    let mouse = { x: null, y: null }
    const handleMouseMove = (e) => {
      mouse.x = e.x
      mouse.y = e.y
    }

    // Draw faint connecting lines between nearby particles — the "network" look.
    const connect = () => {
      for (let a = 0; a < particles.length; a++) {
        for (let b = a + 1; b < particles.length; b++) {
          const dx = particles[a].x - particles[b].x
          const dy = particles[a].y - particles[b].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            const alpha = (1 - dist / 120) * 0.25
            ctx.strokeStyle = `hsla(235, 75%, 55%, ${alpha})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(particles[a].x, particles[a].y)
            ctx.lineTo(particles[b].x, particles[b].y)
            ctx.stroke()
          }
        }
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach((p) => {
        p.update(mouse)
        p.draw()
      })
      connect()
      animationFrameId = requestAnimationFrame(animate)
    }

    resize()
    init()
    animate()

    window.addEventListener('resize', () => {
      resize()
      init()
    })
    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [isApp])

  // Don't even mount the canvas on app routes.
  if (isApp) return null

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-90"
    />
  )
}
