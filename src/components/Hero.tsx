import { ArrowRight } from 'lucide-react'
import { site } from '../data/site'
import { Container, Picture } from './ui'

const delay = (ms: number) => ({ '--hero-delay': `${ms}ms` }) as React.CSSProperties

export function Hero() {
  return (
    <section
      id="inicio"
      aria-labelledby="hero-title"
      className="relative overflow-hidden bg-navy pt-[72px] text-white"
    >
      {/* Textura sutil e brilho dourado */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_85%_40%,rgb(184_155_98/0.16),transparent_70%),radial-gradient(50%_50%_at_0%_100%,rgb(31_53_82/0.9),transparent_70%)]"
      />

      <Container className="relative grid min-h-[calc(100svh-72px)] items-center gap-10 py-12 md:grid-cols-[1.1fr_0.9fr] md:gap-8 lg:py-16">
        <div className="order-2 md:order-1">
          <p
            className="hero-in flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-gold"
            style={delay(0)}
          >
            <span aria-hidden className="h-px w-8 bg-gold" />
            {site.role} · {site.tagline}
          </p>

          <h1
            id="hero-title"
            className="hero-in mt-5 font-serif text-6xl font-semibold leading-[0.95] sm:text-7xl lg:text-8xl"
            style={delay(120)}
          >
            Gabriel
            <br />
            <span className="italic text-gold-light">Aziz</span>
          </h1>

          <p className="hero-in mt-6 text-lg font-medium text-white sm:text-xl" style={delay(240)}>
            {site.headline}
          </p>

          <p
            className="hero-in mt-4 max-w-md border-l-2 border-gold/70 pl-4 font-serif text-xl italic leading-snug text-white/80 sm:text-2xl"
            style={delay(340)}
          >
            “{site.institutional}”
          </p>

          <div className="hero-in mt-9 flex flex-col gap-3 sm:flex-row" style={delay(460)}>
            <a
              href="#atuacao"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-gold px-7 py-3.5 text-sm font-semibold text-navy transition-all hover:bg-gold-light hover:shadow-lg hover:shadow-gold/20"
            >
              Conheça minha atuação
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href="#contato"
              className="inline-flex items-center justify-center rounded-full border border-white/40 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:border-gold hover:text-gold"
            >
              Entre em contato
            </a>
          </div>
        </div>

        <div className="hero-in order-1 mx-auto w-full max-w-[340px] md:order-2 md:max-w-[460px]" style={delay(200)}>
          <div className="relative">
            {/* moldura dourada deslocada */}
            <div
              aria-hidden
              className="absolute -right-3 -top-3 h-full w-full rounded-t-[999px] rounded-b-2xl border border-gold/60 sm:-right-4 sm:-top-4"
            />
            <div className="relative overflow-hidden rounded-t-[999px] rounded-b-2xl bg-navy-800 shadow-2xl shadow-black/40">
              <Picture
                name="gabriel-hero"
                alt="Retrato de Gabriel Aziz, advogado, de terno azul e gravata vinho"
                width={1080}
                height={1076}
                priority
                sizes="(min-width: 768px) 460px, 340px"
                className="aspect-[4/5] w-full object-cover object-[50%_18%]"
              />
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-navy/50 to-transparent"
              />
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
