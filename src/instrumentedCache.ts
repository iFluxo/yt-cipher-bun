import { LRUCache } from "lru-cache";
import { cacheSize } from "./metrics.ts";

export class InstrumentedLRU<T extends {}> extends LRUCache<string, T> {
    private cacheName: string;

    constructor(cacheName: string, maxSize: number) {
        super({ max: maxSize });
        this.cacheName = cacheName;
        cacheSize.labels({ cache_name: this.cacheName }).set(0);
    }

    override set(key: string, value: T, options?: any): this {
        super.set(key, value, options);
        cacheSize.labels({ cache_name: this.cacheName }).set(this.size);
        return this;
    }

    override delete(key: string): boolean {
        const result = super.delete(key);
        cacheSize.labels({ cache_name: this.cacheName }).set(this.size);
        return result;
    }

    override clear(): void {
        super.clear();
        cacheSize.labels({ cache_name: this.cacheName }).set(this.size);
    }

    public remove(key: string): void {
        this.delete(key);
    }
}
