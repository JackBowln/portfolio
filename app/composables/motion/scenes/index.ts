// The scenes by name (F10-T3): each is its own chunk, imported by the director only when motion runs
import type { SceneContext, SceneName } from './types'

export async function loadScene(name: SceneName): Promise<((context: SceneContext) => void) | undefined> {
  if (name === 'home') {
    return (await import('./home')).homeScene
  }
  // The case study's scene arrives with F10-T4 (storyboard-home §9)
  return undefined
}
