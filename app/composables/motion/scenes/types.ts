// What a scene gets (F10-T3): GSAP with the plugins asked for, its root element, and whether the entrances above the
// fold may run (false when the 3 s fallback already showed everything: replaying them would flash the content)
import type { MotionApi } from '../gsap'

export interface SceneContext extends MotionApi {
  scope: Element
  entrance: boolean
}

export type SceneName = 'home' | 'case-study'
