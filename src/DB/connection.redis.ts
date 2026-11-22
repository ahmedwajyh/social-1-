import { createClient, type RedisClientType } from "redis";
import { REDIS_URI } from "../config/config.service.js";

interface ISetValue {
    key: string;
    value: unknown;
    ttl?: number;
}

interface IExpire {
    key: string;
    ttl: number;
}

export class RedisService {
    private readonly redis_client: RedisClientType;

    constructor() {
        this.redis_client = createClient(REDIS_URI ? { url: REDIS_URI } : {});
        this.redis_client.on("error", (error) => {
            console.error("Redis client error:", error);
        });
    }

    async connect(): Promise<void> {
        if (!REDIS_URI) {
            throw new Error("REDIS_URI is not configured.");
        }

        if (!this.redis_client.isOpen) {
            await this.redis_client.connect();
            console.log("Redis connected successfully.");
        }
    }

    async disconnect(): Promise<void> {
        if (this.redis_client.isOpen) {
            await this.redis_client.quit();
        }
    }

    private convertValue(value: unknown): string {
        if (typeof value === "string") return value;

        const result = JSON.stringify(value);
        if (result === undefined) {
            throw new Error("Invalid Redis value.");
        }
        return result;
    }

    async setValue({ key, value, ttl }: ISetValue): Promise<string | null> {
        const mainValue = this.convertValue(value);
        const options = ttl !== undefined ? { EX: ttl } : {};
        return this.redis_client.set(key, mainValue, options);
    }

    async updateValue({ key, value, ttl }: ISetValue): Promise<number> {
        const mainValue = this.convertValue(value);
        const options = {
            XX: true as const,
            ...(ttl !== undefined ? { EX: ttl } : {})
        };
        const result = await this.redis_client.set(key, mainValue, options);
        return result === "OK" ? 1 : 0;
    }

    async getValue(key: string): Promise<unknown> {
        const data = await this.redis_client.get(key);
        if (data === null) return null;

        try {
            return JSON.parse(data);
        } catch {
            return data;
        }
    }

    async ttl(key: string): Promise<number> {
        return this.redis_client.ttl(key);
    }

    async expire({ key, ttl }: IExpire): Promise<boolean> {
        const result = await this.redis_client.expire(key, ttl);
        return result > 0;
    }

    async deleteKey(key: string): Promise<number> {
        return this.redis_client.del(key);
    }

    async keys(prefix: string): Promise<string[]> {
        return this.redis_client.keys(`${prefix}*`);
    }

    async incr(key: string): Promise<number> {
        return this.redis_client.incr(key);
    }
}

export default new RedisService();
