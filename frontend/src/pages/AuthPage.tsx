import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

export default function AuthPage() {
  const { signInWithPassword, signUpWithPassword, signInWithGoogle, signInWithAzure } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      if (isSignup) {
        await signUpWithPassword(email, password);
      } else {
        await signInWithPassword(email, password);
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
          <h1 style={{ margin: '6px 0 0', fontSize: 20 }}>{isSignup ? 'Create account' : 'Sign in'}</h1>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <input
            className="field"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="field"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>}
          <button className="btn btn-primary" disabled={loading || !email || !password} onClick={onSubmit}>
            {loading ? 'Please wait...' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </div>

        <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => void signInWithGoogle()}>
            Continue with Google
          </button>
          <button className="btn btn-ghost" onClick={() => void signInWithAzure()}>
            Continue with Microsoft
          </button>
        </div>

        <button
          className="btn btn-ghost"
          style={{ marginTop: 14, width: '100%' }}
          onClick={() => setIsSignup((v) => !v)}
        >
          {isSignup ? 'Already have an account? Sign in' : 'Need an account? Register'}
        </button>
      </div>
    </div>
  );
}
