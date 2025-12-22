/* eslint-disable @typescript-eslint/naming-convention -- tsdown defines */

declare global {
  export const __DEV__: boolean
  export const __VERSION__: string
  export const ENTT_SPARSE_PAGE: number | undefined
  export const ENTT_PACKED_PAGE: number | undefined
  export const ENTT_NO_ETO: boolean | undefined
  export const ENTT_NO_MIXIN: boolean | undefined
  export const ENTT_ASSERT: ((condition: boolean, message: string) => void) | undefined
}

export {}
