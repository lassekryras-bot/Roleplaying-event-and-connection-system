'use client';

import { FormEvent, useState } from 'react';
import React from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '@/contexts/role-context';

const ROLES = ['player', 'gm', 'observer'];

export default function LoginPage() {
  const { role, setRole } = useRole();
  const [selectedRole, setSelectedRole] = useState(role);
  const router = useRouter();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRole(selectedRole);
    router.push('/project');
  };

  return (
    <section>
      <h1>Role selection</h1>
      <p>Select a temporary role for MVP testing.</p>
      <form onSubmit={onSubmit} className="card">
        <label htmlFor="role">Role</label>
        <select id="role" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)}>
          {ROLES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button type="submit">Continue</button>
      </form>
    </section>
  );
}
