import { Redis } from 'ioredis';
import { Inject } from '@nestjs/common';
import { DependencyInjection } from '../../../common-domain/DependencyInjection';
import { CacheOptions } from '../CacheOptions';
import UserRepository from '../../../../modules/user/domain/application-service/ports/output/repository/UserRepository';

export default class RedisCacheMemory<Value extends string | number | object> {
  public constructor(
    @Inject(DependencyInjection.REDIS_CLIENT)
    protected readonly redis: Redis,
    @Inject(DependencyInjection.USER_REPOSITORY)
    protected readonly userRepository: UserRepository,
  ) {}

  public async get(key: string): Promise<Value | null> {
    const value = await this.redis.get(String(key));
    return value ? this.parseValue(value) : null;
  }

  public async getKeysByIndex(index: string): Promise<string[]> {
    return this.redis.smembers(index);
  }

  public async set(
    key: string,
    value: Value,
    options?: CacheOptions,
  ): Promise<void> {
    await this.redis.set(
      String(key),
      this.serializeValue(value),
      ...this.optionsToArgs(options),
    );
  }

  public async setAndSaveIndex(param: {
    key: string;
    value: Value;
    index: string;
    options?: { ttl?: number };
  }): Promise<void> {
    const { key, value, index, options } = param;
    await this.redis
      .multi()
      .set(
        String(key),
        this.serializeValue(value),
        ...this.optionsToArgs(options),
      )
      .sadd(index, String(key))
      .exec();
  }

  public async delete(key: string): Promise<void> {
    await this.redis.del(String(key));
  }

  public async deleteAndRemoveIndex(key: string, index: string): Promise<void> {
    await this.redis.multi().del(String(key)).srem(index, String(key)).exec();
  }

  public async setExpiresIfNotSet(
    key: string,
    expiresInSec: number,
  ): Promise<void> {
    const keyExpiresIn: number = await this.redis.ttl(String(key));
    if (keyExpiresIn !== -1) {
      await this.redis.expire(String(key), expiresInSec);
    }
  }

  private serializeValue(value: Value): string | number {
    return typeof value === 'object' ? JSON.stringify(value) : value;
  }

  private parseValue(value: string): Value {
    const parsedValue = JSON.parse(value);
    for (const key of Object.keys(parsedValue)) {
      if (key.startsWith('_')) {
        const temp = parsedValue[key];
        delete parsedValue[key];
        parsedValue[key.slice(1)] = temp;
      }
    }
    return parsedValue as Value;
  }

  private optionsToArgs(options?: CacheOptions): any[] {
    const args: any[] = [];
    if (options?.ttl) {
      args.push('EX', options.ttl);
    }
    return args;
  }
}
