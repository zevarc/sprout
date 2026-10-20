import { describe, it, expect } from 'vitest';
import { createTestDb } from './helpers/d1-memory.js';
import {
	createInvite,
	getInviteByTokenHash,
	isInviteUsable,
	acceptInvite
} from '$lib/server/repositories/invites';
import { createActor, listMembers, deleteActor } from '$lib/server/repositories/actors';

describe('invites', () => {
	it('stores only the token hash and is single-use', async () => {
		const { db } = createTestDb();
		const member = await createActor(db, { kind: 'member', displayName: 'Mom' });
		const invite = await createInvite(db, { tokenHash: 'h1', label: 'Mom', ttlSeconds: 3600 });

		expect(invite.acceptedAt).toBeNull();
		expect(isInviteUsable(invite)).toBe(true);
		expect((await getInviteByTokenHash(db, 'h1'))?.id).toBe(invite.id);

		await acceptInvite(db, invite.id, member.id);
		expect(isInviteUsable(await getInviteByTokenHash(db, 'h1'))).toBe(false);
	});

	it('treats an expired invite as unusable', async () => {
		const { db } = createTestDb();
		await createInvite(db, { tokenHash: 'h2', ttlSeconds: -10 });
		expect(isInviteUsable(await getInviteByTokenHash(db, 'h2'))).toBe(false);
	});
});

describe('members', () => {
	it('lists members and removes them (with their sessions)', async () => {
		const { db } = createTestDb();
		const member = await createActor(db, { kind: 'member', displayName: 'Mom' });

		expect((await listMembers(db)).map((m) => m.id)).toContain(member.id);

		await deleteActor(db, member.id);
		expect(await listMembers(db)).toEqual([]);
	});
});
