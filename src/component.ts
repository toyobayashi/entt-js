import type { EntityConstructor } from "./entity"
import { defineTemplate } from "./template"
import { config, isEmptyClass } from "./config"

export interface ComponentTraits<T, E> {
  ElementType: T
  EntityType: E
  pageSize: number
  inPlaceDelete: boolean
}

export interface ComponentTraitsTemplate {
  <T extends Function, E extends EntityConstructor>(Type: T, Entity: E): ComponentTraits<T, E>
}

export const componentTraitsTemplate = defineTemplate<ComponentTraitsTemplate>(function<T extends Function, E extends EntityConstructor> (Type: T, Entity: E) {
  return {
    ElementType: Type,
    EntityType: Entity,
    pageSize: Type == null ? 0 : ('pageSize' in Type ? Type.pageSize : (isEmptyClass(Type) ? 0 : config.packedPage)),
    inPlaceDelete: (Type != null && 'inPlaceDelete' in (Type as any)) ? (Type as any).inPlaceDelete : false
  }
})
