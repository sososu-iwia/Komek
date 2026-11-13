const token = name => `rgb(var(--${name}) / <alpha-value>)`;
module.exports = {
  darkMode: 'class',
  safelist: ['avatar-violet', 'avatar-teal', 'avatar-amber', 'avatar-slate', 'tag-green', 'tag-blue', 'tag-gray', 'tag-amber', 'tag-red', 'btn-primary', 'btn-secondary', 'btn-danger', 'btn-ghost'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: { background: token('background'), surface: token('surface'), elevated: token('elevated'), foreground: token('foreground'), muted: token('muted'), border: token('border'), brand: token('brand'), 'brand-foreground': token('brand-foreground'), 'brand-soft': token('brand-soft'), 'brand-text': token('brand-text'), accent: token('accent'), 'accent-soft': token('accent-soft'), 'accent-text': token('accent-text'), danger: token('danger'), 'danger-soft': token('danger-soft'), warning: token('warning'), 'warning-soft': token('warning-soft') },
    fontFamily: { sans: ['Inter Variable', 'Inter', 'Arial', 'sans-serif'] },
    boxShadow: { soft: '0 2px 8px rgb(15 23 42 / .025)', lift: '0 12px 35px rgb(15 23 42 / .07)' },
    keyframes: { enter: { from: { opacity: 0, transform: 'translateY(5px)' }, to: { opacity: 1, transform: 'translateY(0)' } } },
    animation: { enter: 'enter .18s ease-out' }
  } },
  plugins: []
};
