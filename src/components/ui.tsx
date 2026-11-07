import type { CSSProperties, ElementType, ReactNode } from 'react'
import { useReveal } from '../hooks/useReveal'

export function Container({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-5 sm:px-8 ${className}`}>{children}</div>
  )
}

export function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode
  delay?: number
  className?: string
  as?: ElementType
}) {
  const { ref, visible } = useReveal<HTMLElement>()
  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  children,
  light = false,
  id,
}: {
  eyebrow: string
  title: string
  children?: ReactNode
  light?: boolean
  id?: string
}) {
  return (
    <Reveal className="max-w-2xl">
      <p
        className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] ${
          light ? 'text-gold' : 'text-gold-dark'
        }`}
      >
        <span aria-hidden className="h-px w-8 bg-current" />
        {eyebrow}
      </p>
      <h2
        id={id}
        className={`mt-4 font-serif text-4xl font-semibold leading-tight sm:text-5xl ${
          light ? 'text-white' : 'text-navy'
        }`}
      >
        {title}
      </h2>
      {children && (
        <div className={`mt-5 text-base leading-relaxed ${light ? 'text-white/75' : 'text-graphite/80'}`}>
          {children}
        </div>
      )}
    </Reveal>
  )
}

/** Selo discreto para conteúdo ainda a ser confirmado. */
export function PendingBadge({ children = 'A confirmar' }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gold/50 bg-gold/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-gold-dark">
      {children}
    </span>
  )
}

export function Picture({
  name,
  alt,
  width,
  height,
  className = '',
  priority = false,
  sizes,
}: {
  name: string
  alt: string
  width: number
  height: number
  className?: string
  priority?: boolean
  sizes: string
}) {
  const base = import.meta.env.BASE_URL
  return (
    <picture>
      <source
        type="image/webp"
        srcSet={`${base}images/${name}-640.webp 640w, ${base}images/${name}-1080.webp 1080w`}
        sizes={sizes}
      />
      <img
        src={`${base}images/${name}.jpg`}
        alt={alt}
        width={width}
        height={height}
        className={className}
        decoding={priority ? 'sync' : 'async'}
        loading={priority ? 'eager' : 'lazy'}
        {...(priority ? { fetchPriority: 'high' as const } : {})}
      />
    </picture>
  )
}
