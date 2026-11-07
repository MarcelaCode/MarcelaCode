import { ArrowUpRight, Mail, MapPin } from 'lucide-react'
import { site, whatsappUrl } from '../data/site'
import { InstagramIcon, WhatsAppIcon } from './Icons'
import { Container, PendingBadge, Reveal, SectionHeading } from './ui'

export function Contact() {
  const c = site.contact
  const rows = [
    {
      icon: <Mail size={20} aria-hidden />,
      label: 'E-mail profissional',
      value: c.email,
      href: `mailto:${c.email}`,
    },
    {
      icon: <InstagramIcon width={20} height={20} />,
      label: 'Instagram profissional',
      value: `@${c.instagramHandle}`,
      href: c.instagramUrl,
      external: true,
    },
    {
      icon: <MapPin size={20} aria-hidden />,
      label: 'Localização de atendimento',
      value: c.location,
    },
  ]

  return (
    <section id="contato" aria-labelledby="contato-title" className="relative overflow-hidden bg-navy py-20 text-white sm:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_100%_0%,rgb(184_155_98/0.14),transparent_70%)]"
      />
      <Container className="relative grid gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <SectionHeading eyebrow="Contato" title="Vamos conversar?" light id="contato-title">
            <p>
              Conte brevemente a sua situação. O primeiro contato é o ponto de partida para
              entender como a orientação jurídica pode ajudar.
            </p>
          </SectionHeading>

          <Reveal delay={120}>
            <a
              href={whatsappUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-9 inline-flex items-center gap-3 rounded-full bg-[#25D366] px-7 py-4 text-base font-semibold text-navy transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#25D366]/25"
            >
              <WhatsAppIcon width={22} height={22} />
              Conversar pelo WhatsApp
              <ArrowUpRight size={18} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
            </a>
            <p className="mt-3 text-xs text-white/60">
              A conversa abrirá com uma mensagem inicial já preenchida.
            </p>
          </Reveal>
        </div>

        <Reveal delay={160}>
          <ul className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.04]">
            {rows.map((r) => {
              const body = (
                <>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-gold/50 text-gold">
                    {r.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] uppercase tracking-[0.18em] text-white/55">
                      {r.label}
                    </span>
                    <span className="mt-0.5 block break-words text-base text-white">
                      {r.value ?? <PendingBadge>A informar</PendingBadge>}
                    </span>
                  </span>
                </>
              )
              return (
                <li key={r.label}>
                  {r.href && r.value ? (
                    <a
                      href={r.href}
                      {...(r.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className="flex items-center gap-4 p-5 transition-colors hover:bg-white/[0.05]"
                    >
                      {body}
                    </a>
                  ) : (
                    <div className="flex items-center gap-4 p-5">{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </Reveal>
      </Container>
    </section>
  )
}
