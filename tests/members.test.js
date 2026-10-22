import { describe, it, expect } from 'vitest';
import { createTestDb } from './helpers/d1-memory.js';
import { createAsset } from '$lib/server/repositories/assets';
import {
	createPerson,
	createSession,
	ensureOwner,
	getSessionByTokenHash,
	listMembers,
	retirePerson
} from '$lib/server/repositories/people';
import { createInvite, acceptInvite, getInviteByTokenHash, isInviteUsable } from '$lib/server/repositories/invites';

describe('members', () => {
	it('has one owner and lists only members with the role', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		expect(owner.role).toBe('owner');

		const member = await createPerson(db, { role: 'member', displayName: 'M' });
		await createPerson(db, { displayName: 'Commenter' }); // no role

		expect((await listMembers(db)).map((p) => p.id)).toEqual([member.id]);
	});

	it('authority comes from the person, not the session', async () => {
		const { db } = createTestDb();
		const member = await createPerson(db, { role: 'member', displayName: 'M' });

		await createSession(db, member.id, 'hash-1', 60);
		expect(await getSessionByTokenHash(db, 'hash-1')).toEqual({
			personId: member.id,
			role: 'member'
		});

		// Revoking the role changes what the same session resolves to.
		await db.prepare("UPDATE people SET role = NULL WHERE id = ?").bind(member.id).run();
		expect(await getSessionByTokenHash(db, 'hash-1')).toEqual({
			personId: member.id,
			role: null
		});
	});

	it('retiring a member keeps the person and their attribution', async () => {
		const { db } = createTestDb();
		const member = await createPerson(db, {
			role: 'member',
			displayName: 'M',
			emailHash: 'hash'
		});
		await createSession(db, member.id, 'hash-2', 60);
		await createAsset(db, {
			type: 'post',
			slug: 'theirs',
			lang: 'en',
			title: 'T',
			bodyMd: 'x',
			status: 'published',
			authorId: member.id
		});

		await retirePerson(db, member.id);

		const { run, first } = await import('$lib/server/db');
		const row = await first(db, 'SELECT role, email_hash FROM people WHERE id = ?', [member.id]);
		expect(row).toEqual({ role: null, email_hash: null });
		expect(await getSessionByTokenHash(db, 'hash-2')).toBeNull();
		// The asset survived with its author intact (the FK is RESTRICT for a reason).
		const asset = await first(
			db,
			'SELECT a.author_id AS author_id FROM assets a JOIN posts p ON p.id = a.id WHERE p.slug = ?',
			['theirs']
		);
		expect(asset).toEqual({ author_id: member.id });
		void run;
	});

	it('an invite is single-use', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		const invite = await createInvite(db, {
			tokenHash: 'invite-hash',
			label: 'New Member',
			createdBy: owner.id,
			ttlSeconds: 60
		});
		expect(isInviteUsable(invite)).toBe(true);

		const person = await createPerson(db, { role: 'member', displayName: 'New Member' });
		await acceptInvite(db, invite.id, person.id);

		const stored = await getInviteByTokenHash(db, 'invite-hash');
		expect(isInviteUsable(stored)).toBe(false);
		expect(stored?.acceptedBy).toBe(person.id);
	});
});
