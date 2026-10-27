// Better Auth endpoints (ADR-0005 §1). Input validation happens inside Better Auth (its own zod schemas);
// no-store and noindex come from routeRules for /api/**
export default defineEventHandler(event => useAuth(event).handler(toWebRequest(event)))
