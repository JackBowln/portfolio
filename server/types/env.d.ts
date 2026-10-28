// Secrets are not part of `wrangler types` output; they come from .dev.vars (local) or `wrangler secret` (remote).
// Merged into the global Env that useEnv() returns (worker-configuration.d.ts declares it apart from Cloudflare.Env)
declare global {
  interface Env {
    BETTER_AUTH_SECRET?: string
    GITHUB_CLIENT_ID?: string
    GITHUB_CLIENT_SECRET?: string
    /** Numeric GitHub user id of the owner (allowlist) */
    OWNER_GITHUB_ID?: string
    /** Only until the owner exists; delete it afterwards (ADR-0005 §3) */
    BOOTSTRAP_TOKEN?: string
    /** HMAC key for the IPs in audit_log; rotated yearly (ADR-0012 §10) */
    IP_HASH_SALT?: string
  }
}

export {}
