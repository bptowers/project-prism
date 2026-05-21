export const colors = {
  light: {
    bg: { deep: '#f8f9fb', surface: '#ffffff', elevated: '#f0f1f4', overlay: '#e5e7ec' },
    text: { primary: '#111827', secondary: '#374151', muted: '#6b7280' },
    accent: { base: '#2563eb', emphasis: '#1d4ed8', subtle: 'rgba(37, 99, 235, 0.1)' },
    success: { base: '#16a34a', subtle: 'rgba(22, 163, 74, 0.1)' },
    error: { base: '#dc2626', subtle: 'rgba(220, 38, 38, 0.1)' },
    warning: { base: '#d97706', subtle: 'rgba(217, 119, 6, 0.1)' },
    prism: { blue: '#2563eb', green: '#16a34a', amber: '#d97706', red: '#dc2626' },
    border: { base: '#e5e7eb', emphasis: '#d1d5db' },
  },
  dark: {
    bg: { deep: '#0f1117', surface: '#1a1d27', elevated: '#242837', overlay: '#2e3345' },
    text: { primary: '#f0f1f4', secondary: '#c8cdd8', muted: '#9ca3b4' },
    accent: { base: '#3b82f6', emphasis: '#60a5fa', subtle: 'rgba(59, 130, 246, 0.15)' },
    success: { base: '#22c55e', subtle: 'rgba(34, 197, 94, 0.15)' },
    error: { base: '#ef4444', subtle: 'rgba(239, 68, 68, 0.15)' },
    warning: { base: '#f59e0b', subtle: 'rgba(245, 158, 11, 0.15)' },
    prism: { blue: '#3b82f6', green: '#22c55e', amber: '#f59e0b', red: '#ef4444' },
    border: { base: '#2e3345', emphasis: '#3d4258' },
  },
} as const;

export const fonts = {
  display: "'Inter', 'Source Sans 3', sans-serif",
  body: "'Inter', 'Source Sans 3', sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

export const prismGradient = 'linear-gradient(to right, var(--prism-blue) 0%, var(--prism-green) 30%, var(--prism-amber) 70%, var(--prism-red) 100%)';
