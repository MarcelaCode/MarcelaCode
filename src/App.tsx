import { About } from './components/About'
import { Contact } from './components/Contact'
import { FloatingWhatsApp } from './components/FloatingWhatsApp'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { Practice } from './components/Practice'
import { Process } from './components/Process'

export default function App() {
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only z-[60] rounded bg-gold px-4 py-2 font-semibold text-navy focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Ir para o conteúdo
      </a>
      <Header />
      <main id="conteudo">
        <Hero />
        <About />
        <Practice />
        <Process />
        <Contact />
      </main>
      <Footer />
      <FloatingWhatsApp />
    </>
  )
}
