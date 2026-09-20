import React from 'react'
import icons, { type IconPath } from './icons'

interface IconProps {
  className?: string
  icon: keyof typeof icons
  size?: number
}

const Icon = (props: IconProps) => {
  const { size, icon, ...restProps } = props
  const def = icons[icon]
  const paths: IconPath[] = def.paths
    ? def.paths
    : [{ d: def.d || '', fillRule: def.fillRule }]

  return (
    <svg
      height={size ? `${size}px` : undefined}
      viewBox={def.viewBox}
      aria-hidden
      {...restProps}
    >
      {paths.map((path, index) => (
        <path
          key={index}
          fill={path.fill ?? 'currentColor'}
          fillRule={path.fillRule ?? 'nonzero'}
          d={path.d}
          transform={path.transform}
        />
      ))}
    </svg>
  )
}

export default Icon
