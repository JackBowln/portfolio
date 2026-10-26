// `pnpm db:generate` writes SQL migrations; `pnpm db:migrate:local` applies them with wrangler (ADR-0004 §7)
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './server/db/schema/index.ts',
  out: './server/db/migrations',
  casing: 'snake_case',
})
