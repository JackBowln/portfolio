// Secrets are not part of `wrangler types` output; they come from .dev.vars (local) or `wrangler secret` (remote)
declare namespace Cloudflare {
  interface Env {
    BETTER_AUTH_SECRET?: string
  }
}
