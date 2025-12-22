import stableHash from 'stable-hash'
import { Disposable } from './disposable'

export interface SpecializationDefinition {
  predicate: (...args: any[]) => boolean
  render: (...args: any[]) => any
}

export interface InternalSpecializationDefinition extends SpecializationDefinition {
  userland: boolean
}

export class Template<Render extends (...args: any[]) => any> extends Disposable {
  private readonly _registry: Map<string, ReturnType<Render>>
  private _specializations: InternalSpecializationDefinition[]
  public instantiate: Render
  public defaultRender: (this: Template<Render>, ...args: any[]) => any

  public constructor (render: (this: Template<Render>, ...args: any[]) => any, specializations: SpecializationDefinition[] = []) {
    super()
    const registry = new Map<string, ReturnType<Render>>()
    this._registry = registry
    this.defaultRender = render

    this._specializations = specializations.map(spec => ({ ...spec, userland: false }))

    this.instantiate = function (this: Template<Render>, ...args: Parameters<Render>) {
      const r = this.selectSpecialization(...args) ?? render

      const hash = stableHash([r, args])
      if (registry.has(hash)) {
        return registry.get(hash)!
      }

      const ret = r.apply(this, args)
      registry.set(hash, ret as any)
      return ret
    } as Render
  }

  public selectSpecialization (...args: Parameters<Render>): ((...args: Parameters<Render>) => any) | null {
    for (const spec of this._specializations) {
      const hit = spec.predicate.apply(this, args)
      if (hit) {
        return spec.render
      }
    }
    return null
  }

  public addSpecialization (spec: SpecializationDefinition) {
    this._specializations.push({ ...spec, userland: true })
  }

  public removeSpecialization (spec: SpecializationDefinition) {
    const index = this._specializations.findIndex(s => s.predicate === spec.predicate && s.render === spec.render && s.userland)
    if (index !== -1) {
      this._specializations.splice(index, 1)
    }
  }

  public removeAllUserlandSpecializations () {
    this._specializations = this._specializations.filter(s => !s.userland)
  }

  public dispose () {
    this._registry.clear()
    this._specializations.length = 0
  }
}

/*@__NO_SIDE_EFFECTS__*/
export function defineTemplate<Render extends (...args: any[]) => any>(
  render: (this: Template<Render>, ...args: any[]) => any,
  specializations: SpecializationDefinition[] = []
): Template<Render> {
  return new Template<Render>(render, specializations)
}
