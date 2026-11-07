import { GraduationCap, Award, Briefcase, Compass, Heart } from 'lucide-react'
import { aboutFields, aboutIntro } from '../data/site'
import { Container, PendingBadge, Picture, Reveal, SectionHeading } from './ui'

const icons = [GraduationCap, Award, Briefcase, Compass, Heart]

export function About() {
  return (
    <section id="sobre" aria-labelledby="sobre-title" className="bg-white py-20 sm:py-28">
      <Container className="grid items-center gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <Reveal className="mx-auto w-full max-w-[420px] lg:mx-0">
          <div className="relative">
            <div
              aria-hidden
              className="absolute -bottom-4 -left-4 h-full w-full rounded-2xl bg-mist"
            />
            <div
              aria-hidden
              className="absolute -bottom-4 -left-4 h-24 w-24 border-b-2 border-l-2 border-gold"
            />
            <Picture
              name="gabriel-sobre"
              alt="Gabriel Aziz sorrindo, de terno azul e gravata vinho"
              width={1080}
              height={1076}
              sizes="(min-width: 1024px) 420px, 90vw"
              className="relative aspect-[4/5] w-full rounded-2xl object-cover object-[50%_20%] shadow-xl shadow-navy/15"
            />
          </div>
        </Reveal>

        <div>
          <SectionHeading eyebrow="Sobre mim" title="Conheça Gabriel Aziz" id="sobre-title">
            {aboutIntro.map((p) => (
              <p key={p} className="mb-3 last:mb-0">
                {p}
              </p>
            ))}
          </SectionHeading>

          <ul className="mt-10 grid gap-3 sm:grid-cols-2">
            {aboutFields.map((f, i) => {
              const Icon = icons[i]
              return (
                <Reveal as="li" key={f.title} delay={i * 70}>
                  <div className="h-full rounded-xl border border-dashed border-gold/60 bg-mist/60 p-4">
                    <div className="flex items-start gap-3">
                      <Icon size={20} className="mt-0.5 shrink-0 text-gold-dark" aria-hidden />
                      <div>
                        <h3 className="text-sm font-semibold text-navy">{f.title}</h3>
                        <p className="mt-1 text-xs text-graphite/70">{f.hint}</p>
                        <div className="mt-2">
                          <PendingBadge>A preencher</PendingBadge>
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              )
            })}
          </ul>
        </div>
      </Container>
    </section>
  )
}
