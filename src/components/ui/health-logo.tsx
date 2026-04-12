import React from 'react'
import Svg, { Circle } from 'react-native-svg'

interface HealthLogoProps {
  size?: number
  /**
   * Color treatment.
   * - `mint` (default): the brand mint scale — for white / light surfaces.
   * - `white`: pure white rings with stepped opacity — for colored / mint
   *   surfaces where the mint variant would disappear.
   */
  variant?: 'mint' | 'white'
}

const MINT = {
  outer: '#A7F3D0',
  middle: '#5EEAD4',
  inner: '#2BBF9E',
} as const

export function HealthLogo({
  size = 96,
  variant = 'mint',
}: HealthLogoProps): React.ReactElement {
  const isWhite = variant === 'white'
  const stroke = isWhite ? '#FFFFFF' : null

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      accessibilityLabel="HealthOS logo"
    >
      <Circle
        cx={512}
        cy={512}
        r={351.12}
        fill="none"
        stroke={stroke ?? MINT.outer}
        strokeWidth={76}
        strokeOpacity={isWhite ? 0.55 : 1}
      />
      <Circle
        cx={512}
        cy={512}
        r={199.12}
        fill="none"
        stroke={stroke ?? MINT.middle}
        strokeWidth={76}
        strokeOpacity={isWhite ? 0.78 : 1}
      />
      <Circle
        cx={512}
        cy={512}
        r={47.12}
        fill="none"
        stroke={stroke ?? MINT.inner}
        strokeWidth={76}
      />
    </Svg>
  )
}
