/**
 * Storage access. Kept framework-agnostic and vendor-light: we declare the
 * minimal structural shapes we use from D1 / R2 instead of pulling
 * `@cloudflare/workers-types` into the global scope. Swapping the host (e.g.
 * to a Node + better-sqlite3 runtime) means reimplementing `D1Database` only.
 */

export interface D1Result<T = unknown> {
	results: T[];
	success: boolean;
	meta: unknown;
}

export interface D1PreparedStatement {
	bind(...values: unknown[]): D1PreparedStatement;
	first<T = unknown>(col?: string): Promise<T | null>;
	all<T = unknown>(): Promise<D1Result<T>>;
	run(): Promise<D1Result>;
}

export interface D1Database {
	prepare(query: string): D1PreparedStatement;
	batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
	exec(query: string): Promise<{ count: number; duration: number }>;
}

export interface R2ObjectBody {
	body: ReadableStream;
	httpMetadata?: { contentType?: string };
}

export interface R2Bucket {
	put(
		key: string,
		value: ReadableStream | ArrayBuffer | string | Blob | null,
		options?: { httpMetadata?: { contentType?: string } }
	): Promise<unknown>;
	get(key: string): Promise<R2ObjectBody | null>;
	delete(key: string): Promise<void>;
	list(options?: { prefix?: string }): Promise<{ objects: { key: string }[] }>;
}

export interface Env {
	DB: D1Database;
	MEDIA: R2Bucket;
	ADMIN_TOKEN?: string;
	SESSION_SECRET?: string;
	IP_HASH_SALT?: string;
	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;
	GIT_MIRROR_TOKEN?: string;
}

/** Throws when the D1 binding is missing (misconfigured environment). */
export function getDb(platform: App.Platform | undefined): D1Database {
	const db = platform?.env?.DB;
	if (!db) throw new Error('D1 binding "DB" is not available on platform.env');
	return db;
}

/** Convenience: run a query and return all rows. */
export async function query<T = unknown>(
	db: D1Database,
	sql: string,
	params: unknown[] = []
): Promise<T[]> {
	const stmt = db.prepare(sql);
	const bound = params.length > 0 ? stmt.bind(...params) : stmt;
	const result = await bound.all<T>();
	return result.results ?? [];
}

/** Convenience: run a query and return the first row (or null). */
export async function first<T = unknown>(
	db: D1Database,
	sql: string,
	params: unknown[] = []
): Promise<T | null> {
	const stmt = db.prepare(sql);
	const bound = params.length > 0 ? stmt.bind(...params) : stmt;
	return (await bound.first<T>()) ?? null;
}

/** Convenience: execute a write statement. */
export async function run(
	db: D1Database,
	sql: string,
	params: unknown[] = []
): Promise<D1Result> {
	const stmt = db.prepare(sql);
	const bound = params.length > 0 ? stmt.bind(...params) : stmt;
	return bound.run();
}
