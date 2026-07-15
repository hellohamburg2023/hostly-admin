export function BrandLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-20 w-20',
  }
  return (
    <img
      src="/favicon-192.png?v=4"
      alt="Hostly"
      className={`${sizes[size]} shrink-0 rounded-[22%] shadow-sm`}
    />
  )
}
