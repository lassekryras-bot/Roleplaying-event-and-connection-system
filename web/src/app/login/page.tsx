'use client';

import { FormEvent, useState } from 'react';
import React from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '@/contexts/role-context';
import { useApiClient } from '@/lib/use-api-client';
import { normalizeUsername } from '@/lib/auth';

export default function LoginPage() {
  const { setSession } = useRole();
  const { login } = useApiClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

    const normalizedUsername = normalizeUsername(username);
    if (normalizedUsername.length === 0 || password.trim().length === 0) {
      setErrorMessage('Username and password are required.');
      return;
    }

    try {
      const response = await login(normalizedUsername, password);
      setSession({
        role: response.user.role.toLowerCase(),
        username: response.user.username,
        userId: response.user.id
      });
      router.push('/project');
    } catch {
      setErrorMessage('Invalid username or password.');
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

        <button type="submit">Sign in</button>

        {errorMessage.length > 0 ? <p role="alert">{errorMessage}</p> : null}
      </form>
    </section>
  );
}
