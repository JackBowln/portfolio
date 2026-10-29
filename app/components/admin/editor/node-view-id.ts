// Ids for labels inside node views. Each node view is mounted as its own small Vue app, where useId() starts over
// and repeats ids across blocks, so a label could point at another block's field
let next = 0

export const nodeViewId = (prefix: string) => `${prefix}-${++next}`
