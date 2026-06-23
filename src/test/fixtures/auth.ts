import { randomUUID } from 'node:crypto';

const FIXED_DATE = '2024-01-01T00:00:00.000Z';
const FIXED_EXPIRES = '2025-01-01T00:00:00.000Z';

export interface TestUserFixture {
	id: string;
	name: string;
	email: string;
	emailVerified: number;
	image: string | null;
	username: string;
	displayUsername: string;
	role: string;
	language: string;
	banned: number;
	banReason: string | null;
	banExpires: string | null;
	createdAt: string;
	updatedAt: string;
}

export function createTestUser(overrides?: Partial<TestUserFixture>): TestUserFixture {
	return {
		id: randomUUID(),
		name: 'Test User',
		email: 'test@example.com',
		emailVerified: 1,
		image: null,
		username: randomUUID(),
		displayUsername: 'Test User',
		role: 'admin',
		language: 'en',
		banned: 0,
		banReason: null,
		banExpires: null,
		createdAt: FIXED_DATE,
		updatedAt: FIXED_DATE,
		...overrides
	};
}

export interface TestSessionFixture {
	id: string;
	userId: string;
	token: string;
	expiresAt: string;
	ipAddress: string | null;
	userAgent: string | null;
	impersonatedBy: string | null;
	createdAt: string;
	updatedAt: string;
}

export function createTestSession(overrides?: Partial<TestSessionFixture>): TestSessionFixture {
	return {
		id: randomUUID(),
		userId: randomUUID(),
		token: randomUUID(),
		expiresAt: FIXED_EXPIRES,
		ipAddress: null,
		userAgent: null,
		impersonatedBy: null,
		createdAt: FIXED_DATE,
		updatedAt: FIXED_DATE,
		...overrides
	};
}
