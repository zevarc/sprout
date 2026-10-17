import type { Env } from './lib/server/db';

declare global {
	namespace App {
		interface Platform {
			env: Env;
			cf?: unknown;
			ctx?: { waitUntil(promise: Promise<unknown>): void };
		}
	}
}

export {};
