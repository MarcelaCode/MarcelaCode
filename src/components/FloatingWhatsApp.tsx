import { whatsappUrl } from '../data/site'
import { WhatsAppIcon } from './Icons'

export function FloatingWhatsApp() {
  return (
    <a
      href={whatsappUrl()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Conversar com Gabriel Aziz pelo WhatsApp"
      className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-navy shadow-xl shadow-black/30 transition-transform duration-300 hover:scale-110 focus-visible:scale-110 sm:bottom-7 sm:right-7"
    >
      <WhatsAppIcon width={28} height={28} />
    </a>
  )
}
