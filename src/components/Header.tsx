import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { navItems, site } from '../data/site'
import { Container } from './ui'

export function Header() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  const solid = scrolled || open

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-500 ${
        solid ? 'bg-navy/95 shadow-lg shadow-black/10 backdrop-blur' : 'bg-transparent'
      }`}
    >
      <Container className="flex h-[72px] items-center justify-between">
        <a href="#inicio" className="group flex items-center gap-3" aria-label={`${site.name} — início`}>
          <span className="grid h-10 w-10 place-items-center rounded-full border border-gold/70 font-serif text-lg font-semibold tracking-wide text-gold transition-colors group-hover:bg-gold group-hover:text-navy">
            GA
          </span>
          <span className="leading-tight">
            <span className="block font-serif text-xl font-semibold text-white">{site.name}</span>
            <span className="block text-[10px] uppercase tracking-[0.25em] text-white/60">
              {site.role}
            </span>
          </span>
        </a>

        <nav aria-label="Navegação principal" className="hidden md:block">
          <ul className="flex items-center gap-8">
            {navItems.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="relative text-sm text-white/85 transition-colors after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-0 after:bg-gold after:transition-all hover:text-white hover:after:w-full"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-full text-white md:hidden"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          aria-controls="menu-mobile"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </Container>

      <div
        id="menu-mobile"
        className={`md:hidden ${open ? 'block' : 'hidden'} h-[calc(100dvh-72px)] bg-navy`}
      >
        <nav aria-label="Navegação móvel" className="px-6 pt-8">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-white/10 py-4 font-serif text-3xl text-white"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
