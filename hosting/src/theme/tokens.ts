// NOTE: The runtime design tokens (colors, fonts, spacing) live as CSS custom
// properties in `global.css` and are consumed via `var(--token)`. This file only
// holds the one JS-side value that a component references directly.
export const prismGradient = 'linear-gradient(to right, var(--prism-blue) 0%, var(--prism-green) 30%, var(--prism-amber) 70%, var(--prism-red) 100%)';
