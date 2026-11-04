// The scenes by name (F10-T3): each is its own chunk, imported by the director only when motion runs
import type { Scene, SceneName } from './types'

export async function loadScene(name: SceneName): Promise<Scene> {
  if (name === 'home') {
    return (await import('./home')).homeScene
  }
  return (await import('./case-study')).caseStudyScene
}
