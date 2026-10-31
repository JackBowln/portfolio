// Contact form limits (F08-T3), apart from the zod schema so the public form reads them without bundling zod
export const CONTACT_LIMITS = { name: 100, email: 254, messageMin: 10, messageMax: 5000 } as const

export type ContactField = 'name' | 'email' | 'message'
