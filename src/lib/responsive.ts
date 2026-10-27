import { Platform, useWindowDimensions } from 'react-native'

/** Phone text may be scaled by the user's font setting, but not so much that layouts break */
export const MAX_FONT_SCALE = 1.25

export interface Layout {
  width: number
  height: number
  /** short side >= 600: tablets and big foldables */
  isTablet: boolean
  /** narrow phones (e.g. 320-359 wide) */
  isSmall: boolean
  /** side padding for screen content */
  gutter: number
  /** width the content may use (centered on tablets) */
  contentWidth: number
  /** columns for tile grids (2 on phones, more on tablets) */
  cols: number
}

const MAX_CONTENT = 760

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions()
  const short = Math.min(width, height)
  const isTablet = short >= 600
  const isSmall = width < 360
  const gutter = isSmall ? 14 : isTablet ? 28 : 20
  const contentWidth = Math.min(width, MAX_CONTENT + gutter * 2) - gutter * 2
  const cols = contentWidth >= 680 ? 4 : contentWidth >= 520 ? 3 : 2
  return { width, height, isTablet, isSmall, gutter, contentWidth, cols }
}

/**
 * Soft drop shadow for iOS only. Android draws elevation shadows as wide blurry halos
 * (worse with colored shadows on dark backgrounds), so there the design relies on borders.
 */
export function softShadow(color: string, opacity = 0.08, radius = 14, y = 6) {
  return Platform.OS === 'ios' ? { shadowColor: color, shadowOpacity: opacity, shadowRadius: radius, shadowOffset: { width: 0, height: y } } : {}
}
