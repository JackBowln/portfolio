// Structured JSON logs for Workers Logs. Never pass PII, IPs, secrets, query strings or bodies (ADR-0012 §7).
type Level = 'info' | 'warn' | 'error'
type Fields = Record<string, string | number | boolean | null | undefined>

function write(level: Level, msg: string, fields: Fields = {}): void {
  const line = JSON.stringify({ level, msg, ...fields })
  if (level === 'error') {
    console.error(line)
  }
  else if (level === 'warn') {
    console.warn(line)
  }
  else {
    console.log(line)
  }
}

export const logger = {
  info: (msg: string, fields?: Fields) => write('info', msg, fields),
  warn: (msg: string, fields?: Fields) => write('warn', msg, fields),
  error: (msg: string, fields?: Fields) => write('error', msg, fields),
}
