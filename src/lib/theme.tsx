import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { prefs } from './prefs'

export type ThemeMode = 'light' | 'dark' | 'system'

const dark = {
  dark: true,
  bg: '#050E09',
  bgAlt: '#08160F',
  surface: '#0D1C14',
  surface2: '#13261B',
  surface3: '#1A3224',
  border: 'rgba(190,255,210,0.08)',
  borderStrong: 'rgba(190,255,210,0.16)',
  text: '#ECF7EF',
  textSoft: '#B7CDBF',
  muted: '#7F988A',
  faint: '#4C6457',
  primary: '#B6F24A', // electric lime
  primaryText: '#071108',
  primarySoft: 'rgba(182,242,74,0.14)',
  green: '#34D399',
  greenSoft: 'rgba(52,211,153,0.14)',
  amber: '#FBBF24',
  amberSoft: 'rgba(251,191,36,0.14)',
  red: '#FB7185',
  redSoft: 'rgba(251,113,133,0.14)',
  blue: '#60A5FA',
  blueSoft: 'rgba(96,165,250,0.14)',
  violet: '#A78BFA',
  violetSoft: 'rgba(167,139,250,0.14)',
  orange: '#FB923C',
  orangeSoft: 'rgba(251,146,60,0.14)',
  overlay: 'rgba(0,0,0,0.6)',
  tabBar: 'rgba(10,24,16,0.82)',
  hero: ['#0B3B23', '#0F5132', '#14532D'] as readonly [string, string, string],
  heroGlow: '#B6F24A',
  shadow: '#000000',
}

export type Palette = Omit<typeof dark, 'dark'> & { dark: boolean }

const light: Palette = {
  dark: false,
  bg: '#F2F6F0',
  bgAlt: '#E8EFE5',
  surface: '#FFFFFF',
  surface2: '#F1F6EF',
  surface3: '#E4EDE1',
  border: 'rgba(12,40,22,0.08)',
  borderStrong: 'rgba(12,40,22,0.16)',
  text: '#0A1A10',
  textSoft: '#2F4538',
  muted: '#5E7466',
  faint: '#9DB0A3',
  primary: '#15803D',
  primaryText: '#FFFFFF',
  primarySoft: 'rgba(21,128,61,0.10)',
  green: '#059669',
  greenSoft: 'rgba(5,150,105,0.10)',
  amber: '#B45309',
  amberSoft: 'rgba(217,119,6,0.12)',
  red: '#DC2626',
  redSoft: 'rgba(220,38,38,0.10)',
  blue: '#2563EB',
  blueSoft: 'rgba(37,99,235,0.10)',
  violet: '#7C3AED',
  violetSoft: 'rgba(124,58,237,0.10)',
  orange: '#EA580C',
  orangeSoft: 'rgba(234,88,12,0.10)',
  overlay: 'rgba(5,20,10,0.45)',
  tabBar: 'rgba(255,255,255,0.86)',
  hero: ['#065F46', '#15803D', '#3F8F1F'] as const,
  heroGlow: '#D9F99D',
  shadow: '#0B3B23',
}

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
}

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 }

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'orange' | 'stone' | 'primary'

/** foreground + soft background for a tone */
export function toneColors(c: Palette, tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case 'green': return { fg: c.green, bg: c.greenSoft }
    case 'amber': return { fg: c.amber, bg: c.amberSoft }
    case 'red': return { fg: c.red, bg: c.redSoft }
    case 'blue': return { fg: c.blue, bg: c.blueSoft }
    case 'violet': return { fg: c.violet, bg: c.violetSoft }
    case 'orange': return { fg: c.orange, bg: c.orangeSoft }
    case 'primary': return { fg: c.primary, bg: c.primarySoft }
    default: return { fg: c.muted, bg: c.surface2 }
  }
}

interface ThemeCtx {
  mode: ThemeMode
  c: Palette
  setMode: (m: ThemeMode) => void
}

const Ctx = createContext<ThemeCtx | null>(null)
const KEY = 'agri.theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme()
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const v = prefs.get(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  })
  const resolved = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    prefs.set(KEY, m === 'system' ? null : m)
  }, [])

  const value = useMemo(() => ({ mode, c: resolved === 'dark' ? dark : light, setMode }), [mode, resolved, setMode])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTheme outside provider')
  return v
}
