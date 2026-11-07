import {
  FileWarning,
  Gavel,
  HeartHandshake,
  PackageSearch,
  Receipt,
  Scale,
  ScrollText,
  type LucideIcon,
} from 'lucide-react'

/**
 * ============================================================
 *  CONTEÚDO EDITÁVEL DO SITE
 * ============================================================
 *  Tudo o que precisa ser confirmado/preenchido pelo advogado
 *  está neste arquivo. Campos com `null` ou marcados com
 *  "PREENCHER" aparecem no site como "a confirmar".
 */

export const site = {
  name: 'Gabriel Aziz',
  role: 'Advogado',
  tagline: 'Direito do Consumidor',
  headline: 'Advogado | Especialista em Direito do Consumidor',
  institutional:
    'Conhecimento jurídico, compromisso e dedicação na defesa dos seus direitos.',

  /** Domínio de produção (usado em SEO, Open Graph e sitemap). PREENCHER. */
  url: 'https://www.gabrielaziz.adv.br',

  contact: {
    /** PREENCHER: número com DDI + DDD, somente dígitos. Ex.: 5511999999999 */
    whatsappNumber: '5500000000000',
    whatsappDisplay: '(00) 00000-0000', // PREENCHER
    whatsappMessage:
      'Olá, Dr. Gabriel! Encontrei seu site e gostaria de conversar sobre uma situação jurídica.',
    email: 'contato@gabrielaziz.adv.br', // PREENCHER (e-mail profissional)
    instagramHandle: '_gabriel_aziz',
    instagramUrl: 'https://www.instagram.com/_gabriel_aziz/',
    /** PREENCHER: cidade/UF e, se desejar, endereço. Use null para ocultar. */
    location: null as string | null,
  },

  /** PREENCHER somente após fornecimento e confirmação. Ex.: 'OAB/UF 00.000' */
  oab: null as string | null,
}

export const whatsappUrl = (message: string = site.contact.whatsappMessage) =>
  `https://wa.me/${site.contact.whatsappNumber}?text=${encodeURIComponent(message)}`

export const navItems = [
  { href: '#sobre', label: 'Sobre' },
  { href: '#atuacao', label: 'Atuação' },
  { href: '#atendimento', label: 'Atendimento' },
  { href: '#contato', label: 'Contato' },
]

/** Seção "Sobre": os campos abaixo aguardam informações reais. */
export const aboutIntro = [
  'Gabriel Aziz é advogado e dedica sua atuação à orientação jurídica de pessoas que enfrentam dificuldades nas relações de consumo.',
  'O atendimento busca ser claro, próximo e responsável: ouvir com atenção, explicar com simplicidade e indicar o caminho jurídico adequado a cada situação.',
]

export const aboutFields: { title: string; hint: string }[] = [
  { title: 'Formação em Direito', hint: 'Instituição e ano de conclusão' },
  {
    title: 'Pós-graduação em Direito do Consumidor',
    hint: 'Instituição e ano de conclusão',
  },
  { title: 'Experiência profissional', hint: 'Trajetória e atuação' },
  { title: 'Áreas de atuação', hint: 'Confirmar áreas com o advogado' },
  { title: 'Valores e princípios', hint: 'Princípios que orientam o atendimento' },
]

export interface PracticeArea {
  title: string
  description: string
  icon: LucideIcon
  featured?: boolean
}

/** SUGESTÕES de conteúdo — confirmar com o advogado antes da publicação. */
export const practiceAreas: PracticeArea[] = [
  {
    title: 'Direito do Consumidor',
    description:
      'Orientação jurídica sobre os direitos previstos no Código de Defesa do Consumidor, em diferentes situações do dia a dia.',
    icon: Scale,
    featured: true,
  },
  {
    title: 'Relações de consumo',
    description:
      'Análise de situações entre consumidores e fornecedores de produtos e serviços.',
    icon: HeartHandshake,
  },
  {
    title: 'Problemas com produtos e serviços',
    description:
      'Orientação em casos de vício, defeito ou falha na prestação de produtos e serviços contratados.',
    icon: PackageSearch,
  },
  {
    title: 'Cobranças indevidas',
    description:
      'Esclarecimentos sobre cobranças que o consumidor não reconhece ou considera incorretas.',
    icon: Receipt,
  },
  {
    title: 'Contratos e práticas abusivas',
    description:
      'Leitura e análise de cláusulas contratuais e de condutas potencialmente abusivas.',
    icon: ScrollText,
  },
  {
    title: 'Responsabilidade civil',
    description:
      'Orientação sobre o dever de reparação em situações em que há dano decorrente de uma relação de consumo.',
    icon: Gavel,
  },
]

export const steps = [
  {
    title: 'Primeiro contato',
    description:
      'Você entra em contato pelo WhatsApp ou e-mail e conta, de forma breve, o que aconteceu. Esse é o ponto de partida para entender o seu caso.',
    icon: HeartHandshake,
  },
  {
    title: 'Análise da situação',
    description:
      'Com os fatos e documentos em mãos, a situação é analisada com atenção, à luz da legislação aplicável.',
    icon: FileWarning,
  },
  {
    title: 'Orientação jurídica e encaminhamento adequado',
    description:
      'Você recebe uma orientação clara sobre os caminhos possíveis, com o encaminhamento mais adequado ao seu caso.',
    icon: Scale,
  },
]
