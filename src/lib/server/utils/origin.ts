function extractIp(hostname: string): string | null {
	const host = hostname.split(':')[0];
	return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ? host : null;
}

function isLocalIp(ip: string): boolean {
	if (ip.startsWith('::ffff:')) ip = ip.slice(7);

	if (ip.includes('.')) {
		const p = ip.split('.').map(Number);
		if (p.length === 4 && p.every((n) => !isNaN(n) && n >= 0 && n <= 255)) {
			if (p[0] === 10) return true;
			if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
			if (p[0] === 192 && p[1] === 168) return true;
			if (p[0] === 127) return true;
			if (p[0] === 169 && p[1] === 254) return true;
		}
	}

	if (ip.includes(':')) {
		if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return true;
		if (/^fc[0-9a-f]/i.test(ip)) return true;
		if (/^fe80:/i.test(ip)) return true;
	}

	return false;
}

/** Returns true for RFC1918 private ranges, loopback, and link-local origins */
export function isLocalNetworkOrigin(origin: string): boolean {
	try {
		const { hostname } = new URL(origin);
		if (['localhost', '0.0.0.0'].includes(hostname)) return true;
		const ip = extractIp(hostname);
		return ip !== null && isLocalIp(ip);
	} catch {
		return false;
	}
}

/**
 * Normalise a value to its URL origin (scheme + host + port).
 * Returns null for malformed input.
 */
export function toOrigin(value: string): string | null {
	try {
		return new URL(value).origin;
	} catch {
		return null;
	}
}

/**
 * Build the set of explicitly configured trusted origins from env vars.
 * Reads BETTER_AUTH_TRUSTED_ORIGINS, BETTER_AUTH_URL, and ORIGIN.
 */
export function getConfiguredTrustedOrigins(): Set<string> {
	const trusted = new Set<string>();

	const add = (v: string) => {
		const o = toOrigin(v.trim());
		if (o) trusted.add(o);
	};

	if (process.env.BETTER_AUTH_TRUSTED_ORIGINS) {
		for (const o of process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(',')) add(o);
	}
	if (process.env.BETTER_AUTH_URL) add(process.env.BETTER_AUTH_URL);
	if (process.env.ORIGIN) add(process.env.ORIGIN);

	return trusted;
}

/** True if the origin is either a local network address or explicitly trusted via env. */
export function isTrustedOrigin(origin: string): boolean {
	if (isLocalNetworkOrigin(origin)) return true;
	return getConfiguredTrustedOrigins().has(origin);
}
