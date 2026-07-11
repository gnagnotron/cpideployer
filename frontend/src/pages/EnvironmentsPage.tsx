import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createEnvironment,
  deleteEnvironment,
  listEnvironments,
  updateEnvironment,
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBaseUrl, setEditBaseUrl] = useState('');
  const [editTokenUrl, setEditTokenUrl] = useState('');
  const [editClientId, setEditClientId] = useState('');
  const [editServiceKey, setEditServiceKey] = useState('');

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

  const updateMut = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<{
        name: string;
        baseUrl: string;
        tokenUrl: string;
        clientId: string;
        serviceKey: string;
      }>;
    }) => updateEnvironment(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['environments'] });
      setEditingId(null);
      setEditServiceKey('');
    },
  });

  function startEdit(item: {
    id: string;
    name: string;
    base_url: string;
    token_url: string;
    client_id: string;
  }) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditBaseUrl(item.base_url);
    setEditTokenUrl(item.token_url);
    setEditClientId(item.client_id);
    setEditServiceKey('');
  }

  function submitEdit() {
    if (!editingId) return;
    const payload: Partial<{
      name: string;
      baseUrl: string;
      tokenUrl: string;
      clientId: string;
      serviceKey: string;
    }> = {
      name: editName,
      baseUrl: editBaseUrl,
      tokenUrl: editTokenUrl,
      clientId: editClientId,
    };
    if (editServiceKey.trim()) {
      payload.serviceKey = editServiceKey;
    }
    updateMut.mutate({ id: editingId, payload });
  }

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
        <textarea
          className="field mono"
          placeholder="Paste Service Key here"
          rows={5}
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
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost" onClick={() => startEdit(item)}>Edit</button>
                    <button className="btn btn-danger" onClick={() => deleteMut.mutate(item.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingId && (
        <div className="panel" style={{ padding: 16, borderRadius: 6, display: 'grid', gap: 10 }}>
          <div style={{ fontWeight: 600 }}>Modifica environment</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input className="field" placeholder="Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <input className="field" placeholder="Base URL" value={editBaseUrl} onChange={(e) => setEditBaseUrl(e.target.value)} />
            <input className="field" placeholder="Token URL" value={editTokenUrl} onChange={(e) => setEditTokenUrl(e.target.value)} />
            <input className="field" placeholder="Client ID" value={editClientId} onChange={(e) => setEditClientId(e.target.value)} />
          </div>
          <textarea
            className="field mono"
            rows={5}
            placeholder="Paste new Service Key (optional, leave empty to keep current)"
            value={editServiceKey}
            onChange={(e) => setEditServiceKey(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={submitEdit} disabled={updateMut.isPending}>
              {updateMut.isPending ? 'Saving...' : 'Save changes'}
            </button>
            <button className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
