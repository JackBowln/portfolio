// The outreach draft's messages (F13-T7). They live here, not in the shared locale files: only the drafter's own chunk
// loads them, so the other pages' messages do not grow (the performance budgets, performance-budgets.json). Every
// locale must provide every key: the `Record<Locale, …>` type makes a missing one a type error. The template's
// placeholders ({name}, {company}) stay in the text and are filled by utils/outreach/draft.ts
import type { OutreachTone } from '~/utils/outreach/draft'

export type OutreachLocale = 'pt-BR' | 'en' | 'es' | 'de' | 'fr'

export interface OutreachMessages {
  title: string
  intro: string
  name: string
  company: string
  opportunity: string
  tone: string
  tones: Record<OutreachTone, string>
  submit: string
  output: string
  copy: string
  copied: string
  copyFailed: string
  required: string
  greeting: Record<OutreachTone, string>
  presentation: Record<OutreachTone, string>
  forCompany: string
  forOpportunity: string
  closing: Record<OutreachTone, string>
}

export const OUTREACH_MESSAGES: Record<OutreachLocale, OutreachMessages> = {
  'pt-BR': {
    title: 'Rascunhar uma mensagem',
    intro: 'Descreva a oportunidade e gere um rascunho para revisar antes de enviar. Nada é enviado nem guardado: o texto fica só nesta página.',
    name: 'Sua identificação (opcional)',
    company: 'Empresa ou equipe (opcional)',
    opportunity: 'A oportunidade ou colaboração',
    tone: 'Tom',
    tones: { professional: 'Profissional', concise: 'Direto', warm: 'Caloroso' },
    submit: 'Gerar rascunho',
    output: 'Rascunho',
    copy: 'Copiar rascunho',
    copied: 'Rascunho copiado.',
    copyFailed: 'Não foi possível copiar. Selecione o texto e copie manualmente.',
    required: 'Descreva a oportunidade para gerar o rascunho.',
    greeting: { professional: 'Olá{name},', concise: 'Oi{name},', warm: 'Oi{name}, obrigado pelo contato!' },
    presentation: {
      professional: 'Sou Vinicius Dias, engenheiro frontend sênior, com mais de 6 anos construindo aplicações web escaláveis com TypeScript, Vue e React.',
      concise: 'Sou Vinicius Dias, engenheiro frontend sênior (6+ anos com TypeScript, Vue e React).',
      warm: 'Sou Vinicius Dias, engenheiro frontend sênior. Há mais de 6 anos construo aplicações web escaláveis com TypeScript, Vue e React, com foco em design systems e arquitetura frontend.',
    },
    forCompany: 'Sobre a oportunidade na {company}:',
    forOpportunity: 'Sobre a sua proposta:',
    closing: {
      professional: 'Fico à disposição para conversar sobre como posso contribuir. Obrigado pelo seu tempo.',
      concise: 'Se fizer sentido, podemos conversar.',
      warm: 'Adoraria saber mais e entender como podemos trabalhar juntos!',
    },
  },
  'en': {
    title: 'Draft a message',
    intro: 'Describe the opportunity and generate a draft to review before you send it. Nothing is sent or stored: the text stays on this page.',
    name: 'Your name (optional)',
    company: 'Company or team (optional)',
    opportunity: 'The opportunity or collaboration',
    tone: 'Tone',
    tones: { professional: 'Professional', concise: 'Concise', warm: 'Warm' },
    submit: 'Generate draft',
    output: 'Draft',
    copy: 'Copy draft',
    copied: 'Draft copied.',
    copyFailed: 'Could not copy. Select the text and copy it manually.',
    required: 'Describe the opportunity to generate a draft.',
    greeting: { professional: 'Hello{name},', concise: 'Hi{name},', warm: 'Hi{name}, thanks for getting in touch!' },
    presentation: {
      professional: 'I\'m Vinicius Dias, a senior frontend engineer with 6+ years building scalable web applications with TypeScript, Vue and React.',
      concise: 'I\'m Vinicius Dias, a senior frontend engineer (6+ years with TypeScript, Vue and React).',
      warm: 'I\'m Vinicius Dias, a senior frontend engineer. For more than 6 years I\'ve built scalable web applications with TypeScript, Vue and React, focusing on design systems and frontend architecture.',
    },
    forCompany: 'About the opportunity at {company}:',
    forOpportunity: 'About your proposal:',
    closing: {
      professional: 'I\'d be glad to talk about how I could contribute. Thank you for your time.',
      concise: 'Happy to talk if this fits.',
      warm: 'I\'d love to hear more and see how we could work together!',
    },
  },
  'es': {
    title: 'Redactar un mensaje',
    intro: 'Describe la oportunidad y genera un borrador para revisar antes de enviarlo. No se envía ni se guarda nada: el texto queda solo en esta página.',
    name: 'Tu nombre (opcional)',
    company: 'Empresa o equipo (opcional)',
    opportunity: 'La oportunidad o colaboración',
    tone: 'Tono',
    tones: { professional: 'Profesional', concise: 'Directo', warm: 'Cercano' },
    submit: 'Generar borrador',
    output: 'Borrador',
    copy: 'Copiar borrador',
    copied: 'Borrador copiado.',
    copyFailed: 'No se pudo copiar. Selecciona el texto y cópialo manualmente.',
    required: 'Describe la oportunidad para generar el borrador.',
    greeting: { professional: 'Hola{name},', concise: 'Hola{name},', warm: '¡Hola{name}, gracias por escribir!' },
    presentation: {
      professional: 'Soy Vinicius Dias, ingeniero frontend senior, con más de 6 años construyendo aplicaciones web escalables con TypeScript, Vue y React.',
      concise: 'Soy Vinicius Dias, ingeniero frontend senior (más de 6 años con TypeScript, Vue y React).',
      warm: 'Soy Vinicius Dias, ingeniero frontend senior. Desde hace más de 6 años construyo aplicaciones web escalables con TypeScript, Vue y React, con foco en design systems y arquitectura frontend.',
    },
    forCompany: 'Sobre la oportunidad en {company}:',
    forOpportunity: 'Sobre tu propuesta:',
    closing: {
      professional: 'Quedo a disposición para conversar sobre cómo podría contribuir. Gracias por tu tiempo.',
      concise: 'Si tiene sentido, podemos hablar.',
      warm: '¡Me encantaría saber más y ver cómo podemos trabajar juntos!',
    },
  },
  'de': {
    title: 'Nachricht entwerfen',
    intro: 'Beschreibe die Gelegenheit und erstelle einen Entwurf zur Prüfung vor dem Senden. Nichts wird gesendet oder gespeichert: Der Text bleibt auf dieser Seite.',
    name: 'Dein Name (optional)',
    company: 'Firma oder Team (optional)',
    opportunity: 'Die Gelegenheit oder Zusammenarbeit',
    tone: 'Ton',
    tones: { professional: 'Professionell', concise: 'Knapp', warm: 'Herzlich' },
    submit: 'Entwurf erstellen',
    output: 'Entwurf',
    copy: 'Entwurf kopieren',
    copied: 'Entwurf kopiert.',
    copyFailed: 'Kopieren nicht möglich. Markiere den Text und kopiere ihn manuell.',
    required: 'Beschreibe die Gelegenheit, um einen Entwurf zu erstellen.',
    greeting: { professional: 'Hallo{name},', concise: 'Hi{name},', warm: 'Hi{name}, danke für deine Nachricht!' },
    presentation: {
      professional: 'Ich bin Vinicius Dias, Senior Frontend Engineer, und entwickle seit über 6 Jahren skalierbare Webanwendungen mit TypeScript, Vue und React.',
      concise: 'Ich bin Vinicius Dias, Senior Frontend Engineer (über 6 Jahre mit TypeScript, Vue und React).',
      warm: 'Ich bin Vinicius Dias, Senior Frontend Engineer. Seit über 6 Jahren entwickle ich skalierbare Webanwendungen mit TypeScript, Vue und React, mit Schwerpunkt auf Design Systems und Frontend-Architektur.',
    },
    forCompany: 'Zur Gelegenheit bei {company}:',
    forOpportunity: 'Zu deinem Vorschlag:',
    closing: {
      professional: 'Ich freue mich, mit dir darüber zu sprechen, wie ich mich einbringen kann. Danke für deine Zeit.',
      concise: 'Gern sprechen wir darüber, wenn es passt.',
      warm: 'Ich würde gern mehr erfahren und sehen, wie wir zusammenarbeiten können!',
    },
  },
  'fr': {
    title: 'Rédiger un message',
    intro: 'Décris l\'opportunité et génère un brouillon à relire avant d\'envoyer. Rien n\'est envoyé ni conservé : le texte reste sur cette page.',
    name: 'Votre nom (facultatif)',
    company: 'Entreprise ou équipe (facultatif)',
    opportunity: 'L\'opportunité ou la collaboration',
    tone: 'Ton',
    tones: { professional: 'Professionnel', concise: 'Concis', warm: 'Chaleureux' },
    submit: 'Générer le brouillon',
    output: 'Brouillon',
    copy: 'Copier le brouillon',
    copied: 'Brouillon copié.',
    copyFailed: 'Copie impossible. Sélectionnez le texte et copiez-le manuellement.',
    required: 'Décrivez l\'opportunité pour générer le brouillon.',
    greeting: { professional: 'Bonjour{name},', concise: 'Bonjour{name},', warm: 'Bonjour{name}, merci pour votre message !' },
    presentation: {
      professional: 'Je suis Vinicius Dias, ingénieur frontend senior, et je construis des applications web évolutives avec TypeScript, Vue et React depuis plus de 6 ans.',
      concise: 'Je suis Vinicius Dias, ingénieur frontend senior (plus de 6 ans avec TypeScript, Vue et React).',
      warm: 'Je suis Vinicius Dias, ingénieur frontend senior. Depuis plus de 6 ans, je construis des applications web évolutives avec TypeScript, Vue et React, en me concentrant sur les design systems et l\'architecture frontend.',
    },
    forCompany: 'Au sujet de l\'opportunité chez {company} :',
    forOpportunity: 'Au sujet de votre proposition :',
    closing: {
      professional: 'Je serais ravi d\'échanger sur la manière dont je pourrais contribuer. Merci pour votre temps.',
      concise: 'Si cela vous semble pertinent, discutons-en.',
      warm: 'J\'aimerais en savoir plus et voir comment nous pourrions travailler ensemble !',
    },
  },
}
