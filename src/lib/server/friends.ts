/**
 * Public friend-link application helpers: URL hygiene and the reciprocal-link
 * probe.
 *
 * A friend link points outward, so submissions are a remote-fetch surface. Only
 * http(s) URLs are accepted, obvious local targets (localhost, private IPv4,
 * `.local`/`.internal`, IP literals with a colon) are refused, and the probe has
 * a hard timeout and a body cap. DNS-level redirects to internal addresses are
 * not covered; this is a cheap filter, not a sandbox.
 */

import { site } from '$lib/site';
import type { ReciprocalState } from '$lib/server/repositories/friendApplications';

const PROBE_TIMEOUT_MS = 5000;
/** Enough for a links page; a probe must never stream an entire archive. */
const PROBE_BODY_LIMIT = 256 * 1024;

function isPrivateHost(hostname: string): boolean {
	const host = hostname.toLowerCase();
	if (host === 'localhost' || host.endsWith('.localhost')) return true;
	if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa')) {
		return true;
	}
	// IPv6 literals arrive bracketed; not worth supporting for a blog link.
	if (host.includes(':')) return true;

	const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (!m) return false;
	const a = Number(m[1]);
	const b = Number(m[2]);
	if (a === 0 || a === 10 || a === 127) return true;
	if (a === 169 && b === 254) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 192 && b === 168) return true;
	if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
	return false;
}

/**
 * Normalizes a submitted URL, or returns null when it is unusable.
 * Credentials and fragments are dropped; the path and query survive.
 */
export function normalizeSiteUrl(value: unknown): string | null {
	const raw = String(value ?? '').trim();
	if (!raw) return null;
	if (raw.length > 2048) return null;

	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return null;
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
	if (url.username || url.password) return null;
	if (!url.hostname || isPrivateHost(url.hostname)) return null;

	url.hash = '';
	return url.toString();
}

/** A bare email check: good enough for a reply-to, never trusted as identity. */
export function normalizeEmail(value: unknown): string | null {
	const email = String(value ?? '').trim();
	if (!email) return null;
	if (email.length > 200) return null;
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
	return email;
}

/** Strips `www.` so `https://www.example.com` and `example.com` match. */
function bareHost(hostname: string): string {
	return hostname.toLowerCase().replace(/^www\./, '');
}

/**
 * Fetches the applicant's own site and looks for a link back to this site.
 * `skipped` means the probe could not run (no URL); `unreachable` means the
 * fetch failed or returned a non-2xx — the admin sees the difference and decides.
 */
export async function checkReciprocal(siteUrl: string): Promise<ReciprocalState> {
	const ourHost = bareHost(new URL(site.url).hostname);
	try {
		const res = await fetch(siteUrl, {
			redirect: 'follow',
			signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
			headers: { 'user-agent': `sprout-friend-check/1.0 (+${site.url})` }
		});
		if (!res.ok) return 'unreachable';
		const text = (await res.text()).slice(0, PROBE_BODY_LIMIT).toLowerCase();
		return text.includes(ourHost) ? 'ok' : 'missing';
	} catch {
		return 'unreachable';
	}
}
