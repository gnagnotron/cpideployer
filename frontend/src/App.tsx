import { Routes, Route, NavLink } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import EnvironmentsPage from './pages/EnvironmentsPage';
import PresetsPage from './pages/PresetsPage';
import AdminPage from './pages/AdminPage';
import OperationsPage from './pages/OperationsPage';
import AuthPage from './pages/AuthPage';
import { useAuth } from './auth/AuthProvider';
import {
  bootstrapOrganization,
  getActiveOrganizationId,
  getCurrentUser,
  setActiveOrganizationId,
} from './api/client';
import { useMemo, useState } from 'react';

const navItems = [
  { to: '/', label: 'Environments', end: true },
  { to: '/operations', label: 'Operations', end: false },
  { to: '/presets', label: 'Presets', end: false },
  { to: '/admin', label: 'Backoffice', end: false },
];

export default function App() {
  const { session, isLoading: authLoading, signOut } = useAuth();
  const qc = useQueryClient();

  const meQuery = useQuery({
    queryKey: ['me', session?.user.id],
    queryFn: getCurrentUser,
    enabled: !!session,
  });

  const [organizationName, setOrganizationName] = useState('');
  const [fullName, setFullName] = useState('');

  const bootstrapMutation = useMutation({
    mutationFn: () => bootstrapOrganization(organizationName, fullName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });

  const memberships = meQuery.data?.memberships ?? [];

  const activeOrgId = useMemo(() => {
    const stored = getActiveOrganizationId();
    if (stored && memberships.some((m) => m.organizationId === stored)) {
      return stored;
    }
    if (memberships.length > 0) {
      setActiveOrganizationId(memberships[0].organizationId);
      return memberships[0].organizationId;
    }
    return null;
  }, [memberships]);

  const activeMembership = memberships.find((m) => m.organizationId === activeOrgId) ?? null;

  if (authLoading) {
    return <LoadingScreen label="Loading authentication..." />;
  }

  if (!session) {
    return <AuthPage />;
  }

  if (meQuery.isLoading) {
    return <LoadingScreen label="Loading profile..." />;
  }

  if (memberships.length === 0) {
    return (
      <OnboardingScreen
        organizationName={organizationName}
        setOrganizationName={setOrganizationName}
        fullName={fullName}
        setFullName={setFullName}
        onSubmit={() => bootstrapMutation.mutate()}
        isLoading={bootstrapMutation.isPending}
      />
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside style={{
        width: 200,
        minWidth: 200,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 0',
      }}>
        {/* Wordmark */}
        <div style={{ padding: '0 18px 24px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
            SAP Integration Suite
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--amber)', letterSpacing: '-0.02em' }}>
            Bulk Deployer
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border-dim)', margin: '0 0 12px' }} />

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                display: 'block',
                padding: '7px 10px',
                borderRadius: 3,
                fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--text-hi)' : 'var(--text-mid)',
                background: isActive ? 'var(--bg-raised)' : 'transparent',
                textDecoration: 'none',
                borderLeft: isActive ? '2px solid var(--amber)' : '2px solid transparent',
                transition: 'background 0.1s, color 0.1s',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-dim)' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <div>
              <select
                className="field"
                value={activeOrgId ?? ''}
                onChange={(e) => {
                  setActiveOrganizationId(e.target.value);
                  qc.invalidateQueries({ queryKey: ['environments'] });
                  qc.invalidateQueries({ queryKey: ['presets'] });
                  qc.invalidateQueries({ queryKey: ['organization-members'] });
                  qc.invalidateQueries({ queryKey: ['audit'] });
                }}
                style={{ fontSize: 11, padding: '4px 6px' }}
              >
                {memberships.map((m) => (
                  <option key={m.organizationId} value={m.organizationId}>
                    {m.organizationName}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }} className="mono">
              {activeMembership?.role}
            </div>
            <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/" element={<EnvironmentsPage />} />
          <Route path="/environments" element={<EnvironmentsPage />} />
          <Route path="/operations" element={<OperationsPage />} />
          <Route path="/presets" element={<PresetsPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
    </div>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div style={{ color: 'var(--text-dim)' }}>{label}</div>
    </div>
  );
}

function OnboardingScreen({
  organizationName,
  setOrganizationName,
  fullName,
  setFullName,
  onSubmit,
  isLoading,
}: {
  organizationName: string;
  setOrganizationName: (value: string) => void;
  fullName: string;
  setFullName: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="panel" style={{ width: '100%', maxWidth: 520, borderRadius: 8, padding: 24 }}>
        <h2 style={{ marginTop: 0 }}>Completa il profilo</h2>
        <p style={{ color: 'var(--text-dim)' }}>
          Inserisci il nome organizzazione. Gli utenti con la stessa organizzazione condivideranno ambienti e preset.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          <input
            className="field"
            placeholder="Full name (optional)"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <input
            className="field"
            placeholder="Organization name"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
          />
          <button className="btn btn-primary" onClick={onSubmit} disabled={isLoading || organizationName.trim().length < 2}>
            {isLoading ? 'Saving...' : 'Enter workspace'}
          </button>
        </div>
      </div>
    </div>
  );
}
