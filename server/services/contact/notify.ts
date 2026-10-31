// The owner's notification of a new contact message (F08-T3), through the send_email binding: only to the address
// verified in Email Routing (the Free plan sends to nothing else). Reply-To is the visitor, so answering is one click
import type { ContactSubmission } from '../../../shared/contact/schemas.ts'

// A header value never carries a line break (header injection); the builder escapes, this keeps the subject one line
const oneLine = (value: string) => value.replace(/[\r\n\t]+/g, ' ').trim()

export function contactNotification(message: ContactSubmission & { id: string }, from: string, to: string): EmailMessageBuilder {
  return {
    from: { name: 'Portfólio', email: from },
    to,
    replyTo: { name: oneLine(message.name), email: message.email },
    subject: `Contato: ${oneLine(message.name).slice(0, 80)}`,
    text: [
      `Nome: ${message.name}`,
      `E-mail: ${message.email}`,
      `Idioma: ${message.locale}`,
      `Mensagem ${message.id}:`,
      '',
      message.message,
    ].join('\n'),
  }
}
