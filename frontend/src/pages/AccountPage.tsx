import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

export default function AccountPage({
  forceReset = false,
  onPasswordUpdated,
}: {
  forceReset?: boolean;
  onPasswordUpdated?: () => void;
}) {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleUpdatePassword() {
    setError(null);
    setMessage(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      setMessage('Password updated successfully.');
      setPassword('');
      setConfirmPassword('');
      onPasswordUpdated?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, display: 'grid', gap: 20 }}>
      <div>
        <h2 style={{ margin: '0 0 8px' }}>Account Security</h2>
        <p style={{ margin: 0, color: 'var(--text-dim)' }}>
          {forceReset
            ? 'Password recovery detected. Set a new password to continue using the portal.'
            : 'You can update your password at any time.'}
        </p>
      </div>

      <div className="panel" style={{ borderRadius: 6, padding: 16, maxWidth: 520, display: 'grid', gap: 10 }}>
        <input
          className="field"
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          className="field"
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>}
        {message && <div style={{ color: 'var(--green)', fontSize: 12 }}>{message}</div>}

        <div>
          <button
            className="btn btn-primary"
            onClick={handleUpdatePassword}
            disabled={loading || !password || !confirmPassword}
          >
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </div>
      </div>
    </div>
  );
}
