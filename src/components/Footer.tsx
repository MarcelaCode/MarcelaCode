import { X } from 'lucide-react'
import { useRef } from 'react'
import { navItems, site } from '../data/site'
import { Container } from './ui'

function PrivacyDialog({ dialogRef }: { dialogRef: React.RefObject<HTMLDialogElement | null> }) {
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="privacidade-title"
      onClick={(e) => e.target === e.currentTarget && dialogRef.current?.close()}
      className="m-auto max-h-[85vh] w-[min(92vw,640px)] overflow-y-auto rounded-2xl bg-white p-0 text-graphite shadow-2xl"
    >
      <div className="p-7 sm:p-9">
        <div className="flex items-start justify-between gap-4">
          <h2 id="privacidade-title" className="font-serif text-3xl font-semibold text-navy">
            Aviso de privacidade
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Fechar aviso de privacidade"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-mist"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-graphite/85">
          <p>
            Este site é institucional e informativo. Ele <strong>não possui formulários, cadastro,
            banco de dados nem cookies de rastreamento</strong>, e não coleta dados pessoais de
            forma automática.
          </p>
          <p>
            Ao entrar em contato por WhatsApp, e-mail ou Instagram, as informações que você
            compartilhar serão tratadas de acordo com a Lei Geral de Proteção de Dados (Lei nº
            13.709/2018), exclusivamente para responder ao seu contato, e protegidas pelo sigilo
            profissional da advocacia.
          </p>
          <p>
            Evite enviar documentos ou dados sensíveis antes de um primeiro retorno do advogado.
            Para dúvidas sobre o tratamento de dados, utilize o e-mail de contato indicado neste
            site.
          </p>
          <p className="text-xs text-graphite/60">
            Texto provisório — a ser revisado e confirmado pelo advogado antes da publicação.
          </p>
        </div>
      </div>
    </dialog>
  )
}

export function Footer() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const c = site.contact

  return (
    <footer className="bg-[#0b1526] pb-24 pt-14 text-white/75 sm:pb-12">
      <Container>
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full border border-gold/70 font-serif text-lg font-semibold text-gold">
                GA
              </span>
              <div className="leading-tight">
                <p className="font-serif text-2xl font-semibold text-white">{site.name}</p>
                <p className="text-sm text-white/60">
                  {site.role} · {site.tagline}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm">
              {site.oab ? (
                <>{site.oab}</>
              ) : (
                <span className="text-white/45">Inscrição na OAB: a ser informada após confirmação.</span>
              )}
            </p>
          </div>

          <nav aria-label="Rodapé">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Navegação</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {navItems.map((i) => (
                <li key={i.href}>
                  <a href={i.href} className="transition-colors hover:text-gold">
                    {i.label}
                  </a>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => dialogRef.current?.showModal()}
                  className="text-left transition-colors hover:text-gold"
                >
                  Aviso de privacidade
                </button>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Contato</h2>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href={`mailto:${c.email}`} className="break-words transition-colors hover:text-gold">
                  {c.email}
                </a>
              </li>
              <li>
                <a
                  href={c.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-gold"
                >
                  @{c.instagramHandle}
                </a>
              </li>
              {c.location && <li>{c.location}</li>}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-xs leading-relaxed text-white/50">
          <p>
            Este site tem caráter exclusivamente informativo e não constitui oferta de serviços,
            captação de clientela ou promessa de resultados, em conformidade com o Estatuto da
            Advocacia, o Código de Ética e Disciplina da OAB e o Provimento nº 205/2021 do Conselho
            Federal da OAB.
          </p>
          <p className="mt-3">
            © {new Date().getFullYear()} {site.name} — {site.role}. Todos os direitos reservados.
          </p>
        </div>
      </Container>
      <PrivacyDialog dialogRef={dialogRef} />
    </footer>
  )
}
