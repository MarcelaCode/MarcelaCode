# Gabriel Aziz | Advocacia

Site institucional estático (React + TypeScript + Vite + Tailwind CSS v4 + Lucide). Sem backend nem banco de dados.

## Comandos

```bash
npm install
npm run dev       # desenvolvimento
npm run build     # typecheck + build em dist/
npm run preview   # servir o build localmente
```

Publicação: envie o conteúdo de `dist/` para qualquer hospedagem estática (Netlify, Vercel, Cloudflare Pages, GitHub Pages em domínio próprio).

## O que precisa ser preenchido

Todo o conteúdo editável está em **`src/data/site.ts`**:

| Campo | Situação |
|---|---|
| `contact.whatsappNumber` / `whatsappDisplay` | **Provisório** (`5500000000000`) — informar o número real (DDI+DDD) |
| `contact.email` | **Provisório** — informar o e-mail profissional |
| `contact.location` | `null` — informar cidade/UF, se desejado |
| `oab` | `null` — preencher somente após fornecimento e confirmação |
| `url` | Domínio provisório — trocar também em `index.html`, `public/robots.txt` e `public/sitemap.xml` |
| `aboutFields` | Formação, pós-graduação, experiência, valores — marcados "A preencher" |
| `practiceAreas` | Sugestões marcadas "a confirmar" — validar com o advogado |

Também revisar o texto provisório do **Aviso de privacidade** (`src/components/Footer.tsx`) e a expressão **"Especialista"** do título (solicitada no briefing): o uso do termo exige que o título esteja devidamente comprovado, conforme a regulamentação da OAB.

## Imagens

`public/images/` contém recortes das duas fotografias fornecidas (sem retoque no rosto), em WebP (640/1080 px) com fallback JPG. Se houver os arquivos originais em alta resolução, substitua mantendo os nomes `gabriel-hero` e `gabriel-sobre`.

## Ética e publicidade

Conteúdo informativo, sem promessa de resultados, depoimentos, resultados de processos ou títulos não confirmados (Estatuto da Advocacia, Código de Ética e Disciplina e Provimento 205/2021).
