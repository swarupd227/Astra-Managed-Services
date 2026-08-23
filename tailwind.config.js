/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic tokens — resolved from CSS variables so light/dark swap cleanly.
        canvas: 'rgb(var(--c-canvas) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        raised: 'rgb(var(--c-raised) / <alpha-value>)',
        sunken: 'rgb(var(--c-sunken) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        'line-strong': 'rgb(var(--c-line-strong) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        'ink-2': 'rgb(var(--c-ink-2) / <alpha-value>)',
        'ink-3': 'rgb(var(--c-ink-3) / <alpha-value>)',
        'ink-inv': 'rgb(var(--c-ink-inv) / <alpha-value>)',
        brand: 'rgb(var(--c-brand) / <alpha-value>)',
        'brand-ink': 'rgb(var(--c-brand-ink) / <alpha-value>)',
        ok: 'rgb(var(--c-ok) / <alpha-value>)',
        warn: 'rgb(var(--c-warn) / <alpha-value>)',
        crit: 'rgb(var(--c-crit) / <alpha-value>)',
        info: 'rgb(var(--c-info) / <alpha-value>)',
        agent: 'rgb(var(--c-agent) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Host Grotesk"', '"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      fontSize: {
        // A notch larger than a classic NOC console: the surfaces are read for
        // hours, and 11px hairline type is what makes software feel dated.
        '2xs': ['0.75rem', { lineHeight: '1.15rem', letterSpacing: '0.004em' }],
        xs: ['0.8125rem', { lineHeight: '1.25rem' }],
        sm: ['0.875rem', { lineHeight: '1.375rem' }],
      },
      borderRadius: { xs: '3px', DEFAULT: '5px', md: '6px', lg: '9px' },
      boxShadow: {
        e1: 'var(--shadow-e1)',
        e2: 'var(--shadow-e2)',
        pop: 'var(--shadow-e3)',
        card: 'var(--shadow-e1)',
        focus: '0 0 0 2px rgb(var(--c-canvas)), 0 0 0 4px rgb(var(--c-brand) / 0.85)',
      },
      transitionTimingFunction: { snap: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in': { from: { transform: 'translateX(16px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        'pulse-ring': { '0%': { transform: 'scale(0.9)', opacity: '0.7' }, '70%': { transform: 'scale(1.6)', opacity: '0' }, '100%': { opacity: '0' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        caret: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0' } },
        'agent-work': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
        'rise-in': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'fade-up': 'fade-up 160ms cubic-bezier(0.2,0.9,0.3,1)',
        'slide-in': 'slide-in 180ms cubic-bezier(0.2,0.9,0.3,1)',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.2,0.9,0.3,1) infinite',
        caret: 'caret 1s steps(1) infinite',
        'agent-work': 'agent-work 1.4s cubic-bezier(0.4,0,0.2,1) infinite',
        'rise-in': 'rise-in 220ms cubic-bezier(0.2,0.9,0.3,1) both',
      },
    },
  },
  plugins: [],
}
