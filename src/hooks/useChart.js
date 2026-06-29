import { useEffect, useRef } from 'react'
import Chart from 'chart.js/auto'

Chart.defaults.color = '#8891ae'
Chart.defaults.font.family = 'Inter'
Chart.defaults.font.size = 11

const GRID = { color: 'rgba(226,229,240,0.9)', drawBorder: false }
const TT   = {
  backgroundColor: '#ffffff',
  titleColor: '#111827',
  bodyColor: '#4a5278',
  borderColor: '#e2e5f0',
  borderWidth: 1,
  padding: 10,
  cornerRadius: 6,
}

export function useChart(canvasRef, config, deps = []) {
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !config) return
    if (chartRef.current) chartRef.current.destroy()

    const { type, labels, datasets, options = {} } = config
    const isDoughnut = type === 'doughnut' || type === 'pie'

    chartRef.current = new Chart(canvasRef.current, {
      type,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: options.legend ?? false, position: 'bottom', labels: { color: '#6b7594', padding: 12, font: { size: 10 } } },
          tooltip: TT,
          ...options.plugins,
        },
        scales: isDoughnut ? {} : {
          x: { grid: { display: false }, ticks: { color: '#6b7594' }, stacked: options.stacked ?? false, ...options.xScale },
          y: { grid: GRID, ticks: { color: '#6b7594', callback: options.pct ? v => v + '%' : undefined }, stacked: options.stacked ?? false, ...options.yScale },
        },
        ...options.extra,
      },
    })

    return () => { chartRef.current?.destroy() }
  }, deps)
}

// Colour helpers
export const PERSON_COLORS = {
  'Hanuman':      '#3dd68c',
  'Anju':         '#4f8ef7',
  'Komal':        '#a78bfa',
  'Mukesh Gupta': '#f25c5c',
  'SID':          '#f7b731',
  'Zaid':         '#e0654e',
}
export function pc(name) { return PERSON_COLORS[name] ?? '#6b7594' }
