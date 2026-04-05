import test from 'node:test';
import assert from 'node:assert/strict';

import {
  authenticateUser,
  findUserByUsername,
  validatePassword,
  getUsernameMatchingMode
} from '../../src/data/inMemoryAuthStore.js';

test('findUserByUsername resolves users with case-insensitive matching', () => {
  const user = findUserByUsername('adMinGm');

  assert.equal(getUsernameMatchingMode(), 'case-insensitive');
  assert.ok(user);
  assert.equal(user.username, 'Admingm');
  assert.equal(user.role, 'GM');
});

test('validatePassword returns true for valid user password', () => {
  const user = findUserByUsername('adminplayer');
  assert.equal(validatePassword(user, '1234'), true);
  assert.equal(validatePassword(user, 'nope'), false);
});

test('authenticateUser returns null for invalid credentials', () => {
  assert.equal(authenticateUser('admingmhelper', 'bad-password'), null);
});
