// Better Auth tables (ADR-0005, data-model §3), plural model names. Property names are Better Auth's field names;
// tests/unit/auth-schema.test.ts compares this file with getAuthTables() so an upgrade cannot drift silently.
// The admin plugin fields (role, ban*, impersonatedBy) exist from the start; the plugin itself is enabled in F03-T3.
// The passkeys table arrives with @better-auth/passkey (F03-T2).
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { ROLES } from '../../../shared/types/enums.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'
import { now } from '../../../shared/utils/time.ts'

const timestamps = {
  createdAt: integer({ mode: 'timestamp_ms' }).notNull().$defaultFn(now),
  updatedAt: integer({ mode: 'timestamp_ms' }).notNull().$defaultFn(now).$onUpdateFn(now),
}

export const users = sqliteTable('users', {
  id: text().primaryKey().$defaultFn(() => uuidv7()),
  name: text().notNull(),
  email: text().notNull().unique('users_email_unique'),
  emailVerified: integer({ mode: 'boolean' }).notNull().default(false),
  image: text(),
  role: text({ enum: ROLES }).notNull().default('viewer'),
  banned: integer({ mode: 'boolean' }).default(false),
  banReason: text(),
  banExpires: integer({ mode: 'timestamp_ms' }),
  ...timestamps,
})

export const sessions = sqliteTable('sessions', {
  id: text().primaryKey().$defaultFn(() => uuidv7()),
  userId: text().notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text().notNull().unique('sessions_token_unique'),
  expiresAt: integer({ mode: 'timestamp_ms' }).notNull(),
  // Always null: IP tracking is disabled (ADR-0005, F03-T1); the audit log keeps only an IP hash (F03-T4)
  ipAddress: text(),
  userAgent: text(),
  impersonatedBy: text(),
  ...timestamps,
}, table => [index('sessions_user_id_idx').on(table.userId)])

export const accounts = sqliteTable('accounts', {
  id: text().primaryKey().$defaultFn(() => uuidv7()),
  userId: text().notNull().references(() => users.id, { onDelete: 'cascade' }),
  // GitHub numeric user id for provider "github"
  accountId: text().notNull(),
  providerId: text().notNull(),
  // OAuth tokens are discarded before they reach the database (server/utils/auth.ts); the columns stay for Better Auth
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: integer({ mode: 'timestamp_ms' }),
  refreshTokenExpiresAt: integer({ mode: 'timestamp_ms' }),
  scope: text(),
  // Unused: email and password sign-in is disabled
  password: text(),
  ...timestamps,
}, table => [
  index('accounts_user_id_idx').on(table.userId),
  // One user per external account
  uniqueIndex('accounts_provider_account_unique').on(table.providerId, table.accountId),
])

export const verifications = sqliteTable('verifications', {
  id: text().primaryKey().$defaultFn(() => uuidv7()),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: integer({ mode: 'timestamp_ms' }).notNull(),
  ...timestamps,
}, table => [index('verifications_identifier_idx').on(table.identifier)])
