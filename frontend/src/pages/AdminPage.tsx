import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentUser, listAudit, listOrganizationMembers, updateOrganizationMemberRole } from '../api/client';
import type { OrgRole } from '../types';

export default function AdminPage() {
  const qc = useQueryClient();

  const { data: members = [] } = useQuery({
    queryKey: ['organization-members'],
    queryFn: listOrganizationMembers,
  });

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: getCurrentUser,
  });

  const { data: audit = [] } = useQuery({
    queryKey: ['audit'],
    queryFn: () => listAudit(100),
  });

  const roleMut = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: OrgRole }) =>
      updateOrganizationMemberRole(memberId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organization-members'] }),
  });

  const activeOrgId = localStorage.getItem('cpideployer.activeOrgId');
  const myMembership = me?.memberships?.find((m) => m.organizationId === activeOrgId);
  const canManageRoles = myMembership?.role === 'owner' || myMembership?.role === 'admin';

  return (
    <div style={{ padding: 24, display: 'grid', gap: 20 }}>
      <h2 style={{ margin: 0 }}>Backoffice</h2>

      <div className="panel" style={{ borderRadius: 6, padding: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Current user</div>
        <div>{me?.email ?? 'Unknown user'}</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
          Role in org: {myMembership?.role ?? 'n/a'}
        </div>
      </div>

      <div className="panel" style={{ borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Members</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['User', 'Role', 'Created', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: 10, fontSize: 11, color: 'var(--text-dim)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} style={{ borderBottom: '1px solid var(--border-dim)' }}>
                <td style={{ padding: 10 }}>
                  <div>{m.fullName ?? m.email ?? m.userId}</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>{m.email ?? m.userId}</div>
                </td>
                <td style={{ padding: 10 }}>{m.role}</td>
                <td style={{ padding: 10 }}>{new Date(m.createdAt).toLocaleString('it-IT')}</td>
                <td style={{ padding: 10, textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    {(['owner', 'admin', 'member'] as OrgRole[]).map((role) => (
                      <button
                        key={role}
                        className="btn btn-ghost"
                        disabled={!canManageRoles || m.role === role || roleMut.isPending}
                        onClick={() => roleMut.mutate({ memberId: m.id, role })}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Audit log</div>
        <div style={{ maxHeight: 320, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['When', 'Action', 'Entity', 'User', 'Payload'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: 10, fontSize: 11, color: 'var(--text-dim)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {audit.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-dim)' }}>
                  <td style={{ padding: 10 }}>{new Date(entry.created_at).toLocaleString('it-IT')}</td>
                  <td style={{ padding: 10 }}>{entry.action}</td>
                  <td style={{ padding: 10 }}>{entry.entity_type}</td>
                  <td style={{ padding: 10 }}>{entry.actor_user_id ?? '-'}</td>
                  <td style={{ padding: 10 }} className="mono">{JSON.stringify(entry.payload)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
