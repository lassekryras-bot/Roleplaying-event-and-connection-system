'use client';

import { FormEvent, useState } from 'react';
import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { normalizeUsername } from '@/lib/auth';
import { api, LOGIN_ERROR_INVALID_CREDENTIALS } from '@/lib/api';

export default function LoginPage() {
  const { login: storeSession } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage('');

    const normalizedUsername = normalizeUsername(username);
    if (normalizedUsername.length === 0 || password.trim().length === 0) {
      setErrorMessage('Username and password are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const user = await api.login(normalizedUsername, password);
      storeSession({
        role: user.role,
        username: user.username,
        userId: user.id
      });
      router.push('/project');
    } catch (error) {
      if (error instanceof Error && error.message === LOGIN_ERROR_INVALID_CREDENTIALS) {
        setErrorMessage('Invalid username or password.');
      } else {
        setErrorMessage('Could not reach the API. Make sure the backend is running on http://localhost:3001.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section>
      <h1>Sign in</h1>
      <p>Usernames are matched case-insensitively.</p>
      <form onSubmit={onSubmit} className="card">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>

        {errorMessage.length > 0 ? <p role="alert">{errorMessage}</p> : null}
      </form>
    </section>
  );
}
