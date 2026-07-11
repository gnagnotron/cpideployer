import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

export default function AuthPage() {
  const {
    signInWithPassword,
    signUpWithPassword,
    signInWithGoogle,
    signInWithAzure,
    requestPasswordReset,
    updatePassword,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'reset'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const showEmailField = mode !== 'reset';
  const showPasswordField = mode !== 'forgot';
  const showConfirmPasswordField = mode === 'reset';

  useEffect(() => {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('type=recovery')) {
      setMode('reset');
    }
  }, []);

  async function onSubmit() {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUpWithPassword(email, password);
        setMessage('Account created. Check your email for confirmation if required.');
      } else if (mode === 'signin') {
        await signInWithPassword(email, password);
      } else if (mode === 'forgot') {
        await requestPasswordReset(email);
        setMessage('Password reset email sent. Check your inbox.');
      } else {
        if (!password || password.length < 8) {
          throw new Error('Password must be at least 8 characters');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        await updatePassword(password);
        setMessage('Password updated. You can now sign in.');
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="panel" style={{ width: '100%', maxWidth: 420, padding: 24, borderRadius: 8 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            CPI Deployer
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 20 }}>
            {mode === 'signup' && 'Create account'}
            {mode === 'signin' && 'Sign in'}
            {mode === 'forgot' && 'Forgot password'}
            {mode === 'reset' && 'Set new password'}
          </h1>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {showEmailField && (
            <input
              className="field"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
          {showPasswordField && (
            <input
              className="field"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          {showConfirmPasswordField && (
            <input
              className="field"
              placeholder="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          )}
          {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>}
          {message && <div style={{ color: 'var(--green)', fontSize: 12 }}>{message}</div>}
          <button
            className="btn btn-primary"
            disabled={
              loading ||
              ((mode === 'signin' || mode === 'signup') && (!email || !password)) ||
              (mode === 'forgot' && !email) ||
              (mode === 'reset' && (!password || !confirmPassword))
            }
            onClick={onSubmit}
          >
            {loading
              ? 'Please wait...'
              : mode === 'signup'
              ? 'Create account'
              : mode === 'signin'
              ? 'Sign in'
              : mode === 'forgot'
              ? 'Send reset email'
              : 'Update password'}
          </button>
        </div>

        {(mode === 'signin' || mode === 'signup') && (
          <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => void signInWithGoogle()}>
              Continue with Google
            </button>
            <button className="btn btn-ghost" onClick={() => void signInWithAzure()}>
              Continue with Microsoft
            </button>
          </div>
        )}

        <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
          {mode !== 'reset' && (
            <button
              className="btn btn-ghost"
              style={{ width: '100%' }}
              onClick={() => setMode((m) => (m === 'signup' ? 'signin' : 'signup'))}
            >
              {mode === 'signup' ? 'Already have an account? Sign in' : 'Need an account? Register'}
            </button>
          )}

          {mode === 'signin' && (
            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setMode('forgot')}>
              Forgot password?
            </button>
          )}

          {mode === 'forgot' && (
            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setMode('signin')}>
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
