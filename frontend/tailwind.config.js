/** @type {import('tailwindcss').Config} */
// Every colour is a CSS variable (see src/index.css) so light and dark share one set of class names.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  // Badge tones are composed at runtime (`badge-${tone}`), so the scanner can't see them.
  safelist: [{ pattern: /^badge-(neutral|bad|warn|good|info|accent)$/ }],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        sunken: token('sunken'),
        line: token('line'),
        'line-strong': token('line-strong'),
        ink: token('ink'),
        'ink-2': token('ink-2'),
        'ink-3': token('ink-3'),
        accent: token('accent'),
        'accent-soft': token('accent-soft'),
        'accent-ink': token('accent-ink'),
        bad: token('bad'),
        'bad-soft': token('bad-soft'),
        warn: token('warn'),
        'warn-soft': token('warn-soft'),
        good: token('good'),
        'good-soft': token('good-soft'),
        info: token('info'),
        'info-soft': token('info-soft'),
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      // Nothing in the UI is smaller than 13px.
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.25rem' }],
        sm: ['0.875rem', { lineHeight: '1.375rem' }],
        base: ['0.9375rem', { lineHeight: '1.5rem' }],
        lg: ['1.0625rem', { lineHeight: '1.5rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.75rem', { lineHeight: '1.1' }],
      },
      boxShadow: {
        pop: '0 8px 28px -6px rgb(0 0 0 / 0.25), 0 0 0 1px rgb(var(--line) / 1)',
      },
    },
  },
  plugins: [],
};
