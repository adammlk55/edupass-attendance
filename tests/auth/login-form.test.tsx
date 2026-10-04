import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoginForm } from '@/components/login-form';

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock('@/lib/supabase-browser', () => ({
  browserClient: () => ({ auth: { signInWithPassword: mocks.signIn } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

async function fill() {
  const user = userEvent.setup();
  render(<LoginForm denied={false} />);
  await user.type(screen.getByLabelText('Adresse e-mail'), 'demo@example.invalid');
  await user.type(screen.getByLabelText('Mot de passe'), 'test-only-password');
  return user;
}

describe('login form credentials never enter navigation', () => {
  it('uses a POST fallback with disabled controls before hydration and no serialized credentials', () => {
    const html = renderToStaticMarkup(<LoginForm denied={false} />);
    expect(html).toContain('method="post"');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('name="email"');
    expect(html).not.toContain('name="password"');
  });

  it('prevents native submit, calls Supabase with state, then replaces /dashboard and refreshes', async () => {
    mocks.signIn.mockResolvedValue({ data: { session: { access_token: 'test' } }, error: null });
    await fill();
    const form = screen.getByLabelText('Adresse e-mail').closest('form')!;
    expect([...new FormData(form).entries()]).toEqual([]);
    expect(fireEvent.submit(form)).toBe(false);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/dashboard'));
    expect(mocks.signIn).toHaveBeenCalledWith({
      email: 'demo@example.invalid',
      password: 'test-only-password',
    });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText('Mot de passe') as HTMLInputElement).value).toBe('');
    expect(window.location.search).toBe('');
  });

  it('shows loading and prevents duplicate submissions while authentication is pending', async () => {
    let finish!: (result: unknown) => void;
    mocks.signIn.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect((screen.getByRole('button', { name: 'Connexion…' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.submit(screen.getByLabelText('Adresse e-mail').closest('form')!);
    expect(mocks.signIn).toHaveBeenCalledTimes(1);
    finish({ data: { session: null }, error: { message: 'Invalid login credentials' } });
    await screen.findByRole('alert');
  });

  it('shows the Supabase authentication error and does not redirect', async () => {
    mocks.signIn.mockResolvedValue({
      data: { session: null },
      error: { message: 'Email not confirmed' },
    });
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Email not confirmed');
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(
      (screen.getByRole('button', { name: 'Se connecter' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('handles network failure without exposing credentials or navigating', async () => {
    mocks.signIn.mockRejectedValue(new Error('Failed to fetch'));
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Failed to fetch');
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
  });

  it('does not redirect if Supabase returns no session', async () => {
    mocks.signIn.mockResolvedValue({ data: { session: null }, error: null });
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect((await screen.findByRole('alert')).textContent).toContain('n’a pas créé de session');
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
