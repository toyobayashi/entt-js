import { componentTraitsTemplate } from "./component"
import { createSafeNew, type SafeInstanceType } from "./config"
import { Disposable } from "./disposable"
import { enttTraitsTemplate, type EnttTraits } from "./entity"
import { distance, type ForwardPointer } from "./iterator"
import { Registry, type BasicRegistry, type BasicRegistryConstructor } from "./registry"
import { DeletionPolicy } from "./sparse-set"
import { storageTypeTTemplate, type EmptyStorageConstructor, type EntityStorage, type EntityStorageConstructor } from "./storage"
import { defineTemplate } from "./template"
import { destructKey, assert as ENTT_ASSERT, Ref, type IRef, type StorageKey } from "./util"

function orphans<T, V> (registry: BasicRegistry<T, V>) {
  const storage = registry.getStorage((registry.constructor as any).EntityType) as unknown as EntityStorage<T, V>

  for (const entt of storage) {
    if (registry.orphan(entt)) {
      storage.erase(entt)
    }
  }
}

export interface BasicSnapshotTemplate {
  <R extends BasicRegistryConstructor<any>>(Registry: R): BasicSnapshotConstructor<R>
}

export interface BasicSnapshotLoaderTemplate {
  <R extends BasicRegistryConstructor<any>>(Registry: R): BasicSnapshotLoaderConstructor<R>
}

export interface BasicContinuousLoaderTemplate {
  <R extends BasicRegistryConstructor<any>>(Registry: R): BasicContinuousLoaderConstructor<R>
}

export interface BasicSnapshotConstructor<R extends BasicRegistryConstructor<any>> {
  new (registry: SafeInstanceType<R>): BasicSnapshot<SafeInstanceType<R['EntityType']>, SafeInstanceType<EnttTraits<R['EntityType']>['EntityType']>>
  prototype: BasicSnapshot<SafeInstanceType<R['EntityType']>, SafeInstanceType<EnttTraits<R['EntityType']>['EntityType']>>
  TraitsType: EnttTraits<SafeInstanceType<R['EntityType']>>
  RegistryType: R
  EntityType: SafeInstanceType<R['EntityType']>
}

export interface BasicSnapshot<E, UE> extends Disposable {
  get (archive: OutputArchive<E, UE>, Type: StorageKey<Function>): this
  getRange (archive: OutputArchive<E, UE>, first: ForwardPointer<E, any>, last: ForwardPointer<E, any>, Type: StorageKey<Function>): this
}

export interface BasicSnapshotLoaderConstructor<R extends BasicRegistryConstructor<any>> {
  new (registry: SafeInstanceType<R>): BasicSnapshotLoader<SafeInstanceType<R['EntityType']>, SafeInstanceType<EnttTraits<R['EntityType']>['EntityType']>>
  prototype: BasicSnapshotLoader<SafeInstanceType<R['EntityType']>, SafeInstanceType<EnttTraits<R['EntityType']>['EntityType']>>
  TraitsType: EnttTraits<SafeInstanceType<R['EntityType']>>
  RegistryType: R
  EntityType: SafeInstanceType<R['EntityType']>
}

export interface BasicSnapshotLoader<E, UE> extends Disposable {
  get (archive: InputArchive<E, UE>, Type: StorageKey<Function>): this
  orphans (): this
}

export interface BasicContinuousLoaderConstructor<R extends BasicRegistryConstructor<any>> {
  new (registry: SafeInstanceType<R>): BasicContinuousLoader<SafeInstanceType<R['EntityType']>, SafeInstanceType<EnttTraits<R['EntityType']>['EntityType']>>
  prototype: BasicContinuousLoader<SafeInstanceType<R['EntityType']>, SafeInstanceType<EnttTraits<R['EntityType']>['EntityType']>>
  TraitsType: EnttTraits<SafeInstanceType<R['EntityType']>>
  RegistryType: R
  EntityType: SafeInstanceType<R['EntityType']>
}

export interface BasicContinuousLoader<E, UE> extends Disposable {
  get (archive: InputArchive<E, UE>, Type: StorageKey<Function>): this
  orphans (): this
  contains (entt: E): boolean
  map (entt: E): E
}

export interface OutputArchive<EntityType, UnderlyingEntityType> {
  saveSize (size: UnderlyingEntityType): void
  saveEntity (entity: EntityType): void
  saveComponent (component: any): void
}

export interface InputArchive<EntityType, UnderlyingEntityType> {
  loadSize (size: IRef<UnderlyingEntityType>): void
  loadEntity (entity: IRef<EntityType>): void
  loadComponent (component: IRef<any>): void
}

export const basicSnapshotTemplate = defineTemplate<BasicSnapshotTemplate>(function<R extends BasicRegistryConstructor<any>> (Registry: R) {
  const TraitsType = enttTraitsTemplate.instantiate(Registry.EntityType)
  const EntityType = Registry.EntityType
  class BasicSnapshot extends Disposable {
    static TraitsType = TraitsType
    static RegistryType = Registry
    static EntityType = EntityType

    private reg: SafeInstanceType<R>

    constructor (registry: SafeInstanceType<R>) {
      super()
      this.reg = registry
    }

    dispose(): void {
      this.reg = null!
    }

    get (archive: OutputArchive<SafeInstanceType<R['EntityType']>, EnttTraits<R['EntityType']>['EntityType']>, Type: StorageKey<Function>): this {
      const [ComponentType] = destructKey(Type)
      const storage = this.reg.getStorage(Type, true)
      if (storage) {
        const base = storage

        archive.saveSize(TraitsType.EntityType(storage.size))
        if (ComponentType === EntityType) {
          archive.saveSize(TraitsType.EntityType(storage.freeList()))
          const first = Registry.CommonType.prototype.rbegin.call(base)
          const last = Registry.CommonType.prototype.rend.call(base)
          for (; !first.equals(last); first.selfPlus()) {
            archive.saveEntity(first.deref())
          }
        } else if (storageTypeTTemplate.instantiate(ComponentType, Registry.EntityType).storagePolicy === DeletionPolicy.InPlace) {
          const it = Registry.CommonType.prototype.rbegin.call(base)
          const last = Registry.CommonType.prototype.rend.call(base)
          for (; !it.equals(last); it.selfPlus()) {
            const entt = it.deref()
            if (Registry.CommonType.isTombstone(entt)) {
              archive.saveEntity(TraitsType.null)
            } else {
              archive.saveEntity(entt)
              const tuple = storage.getAsTuple(entt)
              for (let i = 0; i < tuple.length; ++i) {
                archive.saveComponent(tuple[i])
              }
            }
          }
        } else {
          for (const elem of storage.reach()) {
            archive.saveEntity(elem[0])
            if (elem.length > 1) {
              archive.saveComponent(elem[1])
            }
          }
        }
      } else {
        archive.saveSize(TraitsType.EntityType(0))
      }
      return this
    }

    getRange (archive: OutputArchive<SafeInstanceType<R['EntityType']>, EnttTraits<R['EntityType']>['EntityType']>, first: ForwardPointer<SafeInstanceType<R['EntityType']>, any>, last: ForwardPointer<SafeInstanceType<R['EntityType']>, any>, Type: StorageKey<Function>): this {
      const [ComponentType] = destructKey(Type)
      __DEV__ && ENTT_ASSERT(ComponentType !== EntityType, 'Entity types not supported')
      const storage = this.reg.getStorage(Type, true)
      if (storage && !storage.empty()) {
        archive.saveSize(TraitsType.EntityType(distance(first, last)))

        first = first.clone()
        last = last.clone()
        for (; !first.equals(last); first.selfPlus()) {
          const entt = first.deref()
          if (storage.contains(entt)) {
            archive.saveEntity(entt)
            const tuple = storage.getAsTuple(entt)
            for (let i = 0; i < tuple.length; ++i) {
              archive.saveComponent(tuple[i])
            }
          } else {
            archive.saveEntity(TraitsType.null)
          }
        }
      } else {
        archive.saveSize(TraitsType.EntityType(0))
      }
      return this
    }
  }

  return BasicSnapshot
})

export const basicSnapshotLoaderTemplate = defineTemplate<BasicSnapshotLoaderTemplate>(function<R extends BasicRegistryConstructor<any>> (Registry: R) {
  const TraitsType = enttTraitsTemplate.instantiate(Registry.EntityType)
  const EntityType = Registry.EntityType
  const newEntityType = createSafeNew(EntityType)
  class BasicSnapshotLoader extends Disposable {
    static TraitsType = TraitsType
    static RegistryType = Registry
    static EntityType = EntityType

    private reg: SafeInstanceType<R>

    constructor (registry: SafeInstanceType<R>) {
      super()
      this.reg = registry
    }

    dispose(): void {
      this.reg = null!
    }

    get (archive: InputArchive<SafeInstanceType<R['EntityType']>, EnttTraits<R['EntityType']>['EntityType']>, Type: StorageKey<Function>): this {
      const [ComponentType] = destructKey(Type)
      const storage = this.reg.getStorage(Type)
      
      const length = new Ref<EnttTraits<R['EntityType']>['EntityType']>(TraitsType.EntityType(0))
      archive.loadSize(length)

      if (ComponentType === EntityType) {
        const count = new Ref<EnttTraits<R['EntityType']>['EntityType']>(TraitsType.EntityType(0))
        let placeholder = newEntityType()
        storage.reserve(length.value)
        archive.loadSize(count)

        const entityRef = new Ref<SafeInstanceType<R['EntityType']>>(TraitsType.null)
        for (; length.value > 0; --length.value) {
          archive.loadEntity(entityRef)
          ;(storage as unknown as EntityStorage<SafeInstanceType<R['EntityType']>, any>).generate(entityRef.value)
          placeholder = (entityRef.value > placeholder) ? entityRef.value : placeholder
        }
        (storage as unknown as EntityStorage<SafeInstanceType<R['EntityType']>, any>).startFrom(TraitsType.next(placeholder))
        storage.freeList(count.value)
      } else {
        const other = this.reg.getStorage(EntityType) as unknown as EntityStorage<SafeInstanceType<R['EntityType']>, any>
        const enttRef = new Ref<SafeInstanceType<R['EntityType']>>(TraitsType.null)
        const isEmptyStorage = componentTraitsTemplate.instantiate((storage.constructor as EntityStorageConstructor<any> | EmptyStorageConstructor<any, any>).ElementType, (storage.constructor as EntityStorageConstructor<any> | EmptyStorageConstructor<any, any>).EntityType).pageSize === 0
        const newComponentType = isEmptyStorage ? (() => undefined) : createSafeNew(ComponentType!)

        while (length.value--) {
          archive.loadEntity(enttRef)
          if (!TraitsType.isNull(enttRef.value)) {
            const entity = other.contains(enttRef.value) ? enttRef.value : other.generate(enttRef.value)
            __DEV__ && ENTT_ASSERT(TraitsType.toIntegral(entity) === TraitsType.toIntegral(enttRef.value), 'Entity not available for use')
            if (isEmptyStorage) {
              storage.emplace(entity)
            } else {
              const compRef = new Ref<any>(newComponentType())
              archive.loadComponent(compRef)
              storage.emplace(entity, compRef.value)
            }
          }
        }
      }
      return this
    }

    orphans (): this {
      orphans(this.reg)
      return this
    }
  }

  return BasicSnapshotLoader
})

export const basicContinuousLoaderTemplate = defineTemplate<BasicContinuousLoaderTemplate>(function<R extends BasicRegistryConstructor<any>> (Registry: R) {
  const TraitsType = enttTraitsTemplate.instantiate(Registry.EntityType)
  const EntityType = Registry.EntityType

  class BasicContinuousLoader extends Disposable {
    static RegistryType = Registry
    static EntityType = EntityType
    static TraitsType = TraitsType

    private readonly remloc: Map<SafeInstanceType<R['EntityType']>, [SafeInstanceType<R['EntityType']>, SafeInstanceType<R['EntityType']>]>
    private reg: SafeInstanceType<R>

    private restore (entt: SafeInstanceType<R['EntityType']>): void {
      const entity = TraitsType.toEntity(entt)
      const record = this.remloc.get(entity)
      if (record !== undefined && TraitsType.toIntegral(record[0]) === TraitsType.toIntegral(entt)) {
        if (!this.reg.valid(record[1])) {
          record[1] = this.reg.create()
        }
      } else {
        this.remloc.set(entity, [entt, this.reg.create()])
      }
    }

    constructor (registry: SafeInstanceType<R>) {
      super()
      this.remloc = new Map()
      this.reg = registry
    }

    dispose(): void {
      this.remloc.clear()
      this.reg = null!
    }

    get (archive: InputArchive<SafeInstanceType<R['EntityType']>, EnttTraits<R['EntityType']>['EntityType']>, Type: StorageKey<Function>): this {
      const [ComponentType] = destructKey(Type)
      const storage = this.reg.getStorage(Type)

      const length = new Ref<EnttTraits<R['EntityType']>['EntityType']>(TraitsType.EntityType(0))
      const enttRef = new Ref<SafeInstanceType<R['EntityType']>>(TraitsType.null)
      archive.loadSize(length)

      if (ComponentType === EntityType) {
        const inUse = new Ref<EnttTraits<R['EntityType']>['EntityType']>(TraitsType.EntityType(0))
        storage.reserve(length.value)
        archive.loadSize(inUse)
        for (let pos = 0; pos < inUse.value; ++pos) {
          archive.loadEntity(enttRef)
          this.restore(enttRef.value)
        }
        for (let pos = inUse.value; pos < length.value; ++pos) {
          archive.loadEntity(enttRef)
          const entity = TraitsType.toEntity(enttRef.value)
          const record = this.remloc.get(entity)
          if (record !== undefined) {
            if (this.reg.valid(record[1])) {
              this.reg.destroy(record[1])
            }
            this.remloc.delete(entity)
          }
        }
      } else {
        for (const record of this.remloc.values()) {
          storage.remove(record[1])
        }

        const isEmptyStorage = componentTraitsTemplate.instantiate((storage.constructor as EntityStorageConstructor<any> | EmptyStorageConstructor<any, any>).ElementType, (storage.constructor as EntityStorageConstructor<any> | EmptyStorageConstructor<any, any>).EntityType).pageSize === 0
        const newComponentType = isEmptyStorage ? (() => undefined) : createSafeNew(ComponentType!)

        while (length.value--) {
          archive.loadEntity(enttRef)
          if (!TraitsType.isNull(enttRef.value)) {
            this.restore(enttRef.value)
            if (isEmptyStorage) {
              storage!.emplace(this.map(enttRef.value))
            } else {
              const compRef = new Ref<any>(newComponentType())
              archive.loadComponent(compRef)
              storage!.emplace(this.map(enttRef.value), compRef.value)
            }
          }
        }
      }
      return this
    }

    orphans (): this {
      orphans(this.reg)
      return this
    }

    contains (entt: SafeInstanceType<R['EntityType']>): boolean {
      const record = this.remloc.get(TraitsType.toEntity(entt))
      return record !== undefined && TraitsType.toIntegral(record[0]) === TraitsType.toIntegral(entt)
    }

    map (entt: SafeInstanceType<R['EntityType']>): SafeInstanceType<R['EntityType']> {
      const record = this.remloc.get(TraitsType.toEntity(entt))
      if (record !== undefined && TraitsType.toIntegral(record[0]) === TraitsType.toIntegral(entt)) {
        return record[1]
      }
      return TraitsType.null
    }
  }

  return BasicContinuousLoader
})

export const Snapshot = /*#__PURE__*/ (() => basicSnapshotTemplate.instantiate(Registry))()
export type Snapshot = InstanceType<typeof Snapshot>

export const SnapshotLoader = /*#__PURE__*/ (() => basicSnapshotLoaderTemplate.instantiate(Registry))()
export type SnapshotLoader = InstanceType<typeof SnapshotLoader>

export const ContinuousLoader = /*#__PURE__*/ (() => basicContinuousLoaderTemplate.instantiate(Registry))()
export type ContinuousLoader = InstanceType<typeof ContinuousLoader>
