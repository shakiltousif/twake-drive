import Repository, { AtomicCompareAndSetResult, FindFilter, FindOptions } from "./repository";
import { logger } from "../../../../../../../core/platform/framework";
import { ExecutionContext } from "../../../../../framework/api/crud-service";
import { Connector } from "../connectors";
import { EntityTarget } from "../types";
import NodeCache from "node-cache";

const emptyStats = () => ({ hits: 0, misses: 0, wrongIndex: 0, start: new Date() });
const CACHE_DEFAULT_TTL_S = 5;
const CACHE_DEFAULT_MAX_KEY_COUNT = 10000;
const CACHE_PRINT_PERIOD_MS = 20 * 1000;
const CACHE_PRINT_UPPER_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * This is a passthrough for {@link Repository} that caches requests by a provided
 * `keys` list of fields that must be globally unique.
 * Only {@link Repository.findOne} returns from cache.
 */
export default class CachingRepository<EntityType> extends Repository<EntityType> {
  private readonly cache;
  private cacheStats = emptyStats();

  private startPrintingStats() {
    setInterval(() => {
      const stats = this.cacheStats;
      const ageMs = new Date().getTime() - stats.start.getTime();
      const prefix = `CachingRepository<${this.table}>(${this.keys.join(", ")})`;
      if (stats.hits + stats.misses + stats.wrongIndex === 0) {
        if (ageMs < CACHE_PRINT_UPPER_THRESHOLD_MS) return;
        logger.info(`${prefix} - unused since ${ageMs / 1000}s`);
        return;
      }
      const libCacheStats = this.cache.getStats();
      this.cacheStats = emptyStats();
      logger.info(
        {
          stats: {
            keyCount: libCacheStats.keys,
            valueSize: libCacheStats.vsize,
            ...stats,
          },
          keys: this.keys,
          table: this.table,
          ageMs,
        },
        `${prefix} had ${stats.hits} hits and ${stats.misses} misses (${
          stats.wrongIndex
        } mismatched key query) in ${ageMs / 1000}s`,
      );
    }, CACHE_PRINT_PERIOD_MS);
  }

  constructor(
    connector: Connector,
    table: string,
    entityType: EntityTarget<EntityType>,
    private readonly keys: string[],
    cacheOptions?: ConstructorParameters<typeof NodeCache>[0],
  ) {
    super(connector, table, entityType);
    this.cache = new NodeCache({
      stdTTL: CACHE_DEFAULT_TTL_S,
      maxKeys: CACHE_DEFAULT_MAX_KEY_COUNT,
      ...cacheOptions,
    });
    this.keys.sort();
    this.startPrintingStats();
  }

  private cacheFetEntityKey(entity: EntityType | FindFilter | undefined): string | undefined {
    if (!entity) return undefined;
    const indices = this.keys.map(k => entity[k] as string);
    if (indices.some(x => !x)) return undefined;
    return indices.map(x => encodeURIComponent(x)).join("&");
  }

  private cacheInvalidateEntity(entity: EntityType | undefined) {
    const key = this.cacheFetEntityKey(entity);
    if (key) this.cache.del(key);
  }

  private cacheGet(keys: FindFilter): EntityType | undefined {
    const key = this.cacheFetEntityKey(keys);
    if (!key) {
      this.cacheStats.wrongIndex++;
      return undefined;
    }
    const cached = this.cache.get(key);
    if (cached) {
      this.cacheStats.hits++;
      return cached;
    }
    this.cacheStats.misses++;
    return undefined;
  }

  private cacheSave(entity: EntityType) {
    const key = entity && this.cacheFetEntityKey(entity);
    if (!key) return;
    this.cache.set(key, entity);
  }

  override async atomicCompareAndSet<FieldValueType>(
    entity: EntityType,
    fieldName: keyof EntityType,
    previousValue: FieldValueType | null,
    newValue: FieldValueType | null,
  ): Promise<AtomicCompareAndSetResult<FieldValueType>> {
    this.cacheInvalidateEntity(entity);
    return await super.atomicCompareAndSet(entity, fieldName, previousValue, newValue);
  }

  override async save(entity: EntityType, _context?: ExecutionContext): Promise<void> {
    this.cacheInvalidateEntity(entity);
    await super.save(entity, _context);
  }

  override async saveAll(entities: EntityType[] = [], _context?: ExecutionContext): Promise<void> {
    entities.forEach(entity => this.cacheInvalidateEntity(entity));
    await super.saveAll(entities, _context);
  }

  override async remove(entity: EntityType, _context?: ExecutionContext): Promise<void> {
    this.cacheInvalidateEntity(entity);
    await super.remove(entity, _context);
  }

  async findOne(
    filters: FindFilter,
    options: FindOptions = {},
    context?: ExecutionContext,
  ): Promise<EntityType> {
    const cachedValue = this.cacheGet(filters);
    if (cachedValue) return cachedValue;
    const result = (await this.find(filters, options, context)).getEntities()[0] || null;
    this.cacheSave(result);
    return result;
  }
}
