// Renders a perk icon — either an emoji string (e.g. "🔥") or an image path
// starting with "/" (e.g. "/icons/grease_fire.png"). All UI surfaces that show
// a perk icon should go through this component so future perks can ship a
// custom PNG just by setting `icon: '/icons/<slug>.png'` in PERK_POOL.

interface PerkIconProps {
  icon: string
  size: number
}

export default function PerkIcon({ icon, size }: PerkIconProps) {
  if (icon.startsWith('/')) {
    return (
      <img
        src={icon}
        alt=""
        style={{
          width: `${size}px`,
          height: `${size}px`,
          objectFit: 'contain',
          imageRendering: 'pixelated',
        }}
      />
    )
  }
  return <span style={{ fontSize: `${size}px`, lineHeight: 1 }}>{icon}</span>
}
