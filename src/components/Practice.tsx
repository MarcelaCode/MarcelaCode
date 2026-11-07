import { Info } from 'lucide-react'
import { practiceAreas } from '../data/site'
import { Container, PendingBadge, Reveal, SectionHeading } from './ui'

export function Practice() {
  return (
    <section id="atuacao" aria-labelledby="atuacao-title" className="bg-mist py-20 sm:py-28">
      <Container>
        <SectionHeading eyebrow="Áreas de atuação" title="Direito do Consumidor em foco" id="atuacao-title">
          <p>
            Uma atuação voltada à compreensão e à defesa dos direitos de quem consome produtos e
            serviços.
          </p>
        </SectionHeading>

        <Reveal className="mt-6 flex max-w-2xl items-start gap-2 rounded-lg border border-gold/40 bg-white p-3 text-xs text-graphite/80">
          <Info size={16} className="mt-0.5 shrink-0 text-gold-dark" aria-hidden />
          <p>
            <strong className="font-semibold">Nota de conteúdo:</strong> as áreas abaixo são
            sugestões a confirmar com o advogado e não representam, por ora, especialidades
            comprovadas.
          </p>
        </Reveal>

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {practiceAreas.map((area, i) => {
            const Icon = area.icon
            return (
              <Reveal
                as="li"
                key={area.title}
                delay={(i % 3) * 90}
                className={area.featured ? 'sm:col-span-2 lg:col-span-3' : ''}
              >
                <article
                  className={`group relative h-full overflow-hidden rounded-2xl p-7 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-navy/10 ${
                    area.featured
                      ? 'bg-navy text-white sm:flex sm:items-center sm:gap-8 sm:p-10'
                      : 'bg-white'
                  }`}
                >
                  <div
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border ${
                      area.featured
                        ? 'border-gold/60 text-gold sm:h-16 sm:w-16'
                        : 'border-gold/50 text-gold-dark'
                    }`}
                  >
                    <Icon size={area.featured ? 28 : 22} strokeWidth={1.6} aria-hidden />
                  </div>
                  <div className={area.featured ? 'mt-5 sm:mt-0' : 'mt-5'}>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3
                        className={`font-serif font-semibold ${
                          area.featured ? 'text-3xl text-white sm:text-4xl' : 'text-2xl text-navy'
                        }`}
                      >
                        {area.title}
                      </h3>
                      {area.featured && (
                        <span className="rounded-full bg-gold px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-navy">
                          Foco principal
                        </span>
                      )}
                    </div>
                    <p
                      className={`mt-2 max-w-2xl text-sm leading-relaxed ${
                        area.featured ? 'text-white/75' : 'text-graphite/75'
                      }`}
                    >
                      {area.description}
                    </p>
                    <div className="mt-4">
                      <PendingBadge>Sugestão · a confirmar</PendingBadge>
                    </div>
                  </div>
                </article>
              </Reveal>
            )
          })}
        </ul>
      </Container>
    </section>
  )
}
