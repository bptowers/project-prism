export const colors = {
  bg: { deep: '#0f0e0d', surface: '#1a1816', elevated: '#252220', overlay: '#322e2b' },
  text: { primary: '#e8e4df', secondary: '#b5aea5', muted: '#7a746c' },
  accent: { base: '#d4a574', emphasis: '#c4956a', subtle: 'rgba(212, 165, 116, 0.15)' },
  success: { base: '#7eb563', subtle: 'rgba(126, 181, 99, 0.15)' },
  error: { base: '#c75d5d', subtle: 'rgba(199, 93, 93, 0.15)' },
  prism: { blue: '#6ba3c7', green: '#7eb563', amber: '#d4a574', red: '#c75d5d' },
  border: { base: '#322e2b', emphasis: '#453f3b' },
} as const;

export const fonts = {
  display: "'Playfair Display', serif",
  body: "'Source Sans 3', sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

export const prismGradient = `linear-gradient(to right, ${colors.prism.blue} 0%, ${colors.prism.green} 30%, ${colors.prism.amber} 70%, ${colors.prism.red} 100%)`;
