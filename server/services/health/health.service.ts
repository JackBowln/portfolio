export interface HealthStatus {
  status: 'ok'
  version: string
}

export function getHealth(version: string): HealthStatus {
  return { status: 'ok', version }
}
