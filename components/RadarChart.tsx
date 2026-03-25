'use client'

import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Radar } from 'react-chartjs-2'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

interface CompatibilityRadarProps {
  technicalSkills: number
  experience: number
  softSkills: number
  domainKnowledge: number
  roleFit: number
}

export function CompatibilityRadar({ technicalSkills, experience, softSkills, domainKnowledge, roleFit }: CompatibilityRadarProps) {
  const data = {
    labels: ['Technical Skills', 'Experience', 'Soft Skills', 'Domain Knowledge', 'Role Fit'],
    datasets: [
      {
        label: 'Match',
        data: [technicalSkills, experience, softSkills, domainKnowledge, roleFit],
        backgroundColor: 'rgba(124, 58, 237, 0.2)',
        borderColor: 'rgba(124, 58, 237, 0.8)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(124, 58, 237, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(124, 58, 237, 1)',
      },
    ],
  }

  const options = {
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: {
          display: false,
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        angleLines: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        pointLabels: {
          color: 'rgba(255, 255, 255, 0.6)',
          font: { size: 10 },
        },
      },
    },
    plugins: {
      legend: { display: false },
    },
    responsive: true,
    maintainAspectRatio: true,
  }

  return <Radar data={data} options={options} />
}

// Derive radar values from application data
export function deriveRadarValues(app: {
  matchScore?: { overall?: number; skillsMatch?: number; experienceMatch?: number }
  breakdown?: Array<{ skill: string; match: string; type?: string }>
  stage?: string
}) {
  const skillsMatch = app.matchScore?.skillsMatch ?? 0
  const experienceMatch = app.matchScore?.experienceMatch ?? 0

  const breakdown = app.breakdown || []
  const softSkills = breakdown.filter((b) => b.type === 'soft')
  const softScore = softSkills.length
    ? Math.round((softSkills.filter((b) => b.match === 'full').length / softSkills.length) * 100)
    : skillsMatch

  const domainSkills = breakdown.filter((b) => b.type === 'domain')
  const domainScore = domainSkills.length
    ? Math.round((domainSkills.filter((b) => b.match === 'full').length / domainSkills.length) * 100)
    : skillsMatch

  // Role fit: blend of stage progress + overall
  const stageMap: Record<string, number> = { applied: 50, under_review: 60, shortlisted: 80, interview: 90, decision: 95, outcome: 100 }
  const roleFit = app.stage ? Math.round((stageMap[app.stage] ?? 50) * 0.3 + (app.matchScore?.overall ?? 0) * 0.7) : (app.matchScore?.overall ?? 0)

  return {
    technicalSkills: skillsMatch,
    experience: experienceMatch,
    softSkills: softScore,
    domainKnowledge: domainScore,
    roleFit: Math.min(100, roleFit),
  }
}
