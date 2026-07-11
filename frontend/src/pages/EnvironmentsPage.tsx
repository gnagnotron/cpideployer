import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createEnvironment,
  deleteEnvironment,
  listEnvironments,
} from '../api/client';

export default function EnvironmentsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['environments'],
    queryFn: listEnvironments,
  });

  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [tokenUrl, setTokenUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [serviceKey, setServiceKey] = useState('');

  const createMut = useMutation({
    mutationFn: createEnvironment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['environments'] });
      setName('');
      setBaseUrl('');
      setTokenUrl('');
      setClientId('');
      setServiceKey('');
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteEnvironment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['environments'] }),
  });

  return (
    <div style={{ padding: 24, display: 'grid', gap: 20 }}>
      <div>
        <h2 style={{ margin: '0 0 8px' }}>Ambienti</h2>
        <p style={{ margin: 0, color: 'var(--text-dim)' }}>
          Le service key vengono salvate in DB cifrate lato backend.
        </p>
      </div>

      <div className="panel" style={{ padding: 16, borderRadius: 6, display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 600 }}>Nuovo ambiente</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input className="field" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="field" placeholder="Base URL" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          <input className="field" placeholder="Token URL" value={tokenUrl} onChange={(e) => setTokenUrl(e.target.value)} />
          <input className="field" placeholder="Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} />
        </div>
        <input
          className="field"
          placeholder="Service Key"
          type="password"
          value={serviceKey}
          onChange={(e) => setServiceKey(e.target.value)}
        />
        <div>
          <button
            className="btn btn-primary"
            onClick={() => createMut.mutate({ name, baseUrl, tokenUrl, clientId, serviceKey })}
            disabled={createMut.isPending || !name || !baseUrl || !tokenUrl || !clientId || !serviceKey}
          >
            {createMut.isPending ? 'Saving...' : 'Save environment'}
          </button>
        </div>
      </div>

      <div className="panel" style={{ borderRadius: 6, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Name', 'Base URL', 'Token URL', 'Client ID', 'Updated', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: 10, fontSize: 11, color: 'var(--text-dim)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!isLoading && data.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--border-dim)' }}>
                <td style={{ padding: 10 }}>{item.name}</td>
                <td style={{ padding: 10 }}>{item.base_url}</td>
                <td style={{ padding: 10 }}>{item.token_url}</td>
                <td style={{ padding: 10 }}>{item.client_id}</td>
                <td style={{ padding: 10 }}>{new Date(item.updated_at).toLocaleString('it-IT')}</td>
                <td style={{ padding: 10, textAlign: 'right' }}>
                  <button className="btn btn-danger" onClick={() => deleteMut.mutate(item.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
