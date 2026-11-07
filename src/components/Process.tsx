import { steps } from '../data/site'
import { Container, Reveal, SectionHeading } from './ui'

export function Process() {
  return (
    <section id="atendimento" aria-labelledby="atendimento-title" className="bg-white py-20 sm:py-28">
      <Container>
        <SectionHeading eyebrow="Atendimento" title="Como posso ajudar?" id="atendimento-title">
          <p>
            Entender o seu caso é o primeiro passo. Veja, de forma simples, como funciona o
            atendimento jurídico.
          </p>
        </SectionHeading>

        <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          <div
            aria-hidden
            className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent md:block"
          />
          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <Reveal as="li" key={step.title} delay={i * 120} className="relative">
                <div className="relative z-10 grid h-14 w-14 place-items-center rounded-full border border-gold bg-white font-serif text-2xl font-semibold text-gold-dark">
                  {i + 1}
                </div>
                <Icon size={22} strokeWidth={1.5} className="mt-6 text-gold-dark" aria-hidden />
                <h3 className="mt-3 font-serif text-2xl font-semibold leading-snug text-navy">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-graphite/80">{step.description}</p>
              </Reveal>
            )
          })}
        </ol>

        <Reveal className="mt-14 max-w-3xl border-t border-mist pt-6 text-xs leading-relaxed text-graphite/65">
          O atendimento tem caráter informativo e de orientação. Cada situação é única e nenhum
          resultado pode ser prometido ou garantido.
        </Reveal>
      </Container>
    </section>
  )
}
