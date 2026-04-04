import { useState } from 'react';
import api from '../../api/axios';

interface AdminControlPanelProps {
  access_level: number;
}

export default function AdminControlPanel({ access_level }: AdminControlPanelProps) {
  const [promoteInput, setPromoteInput] = useState('');
  const [promoteStatus, setPromoteStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [promoting, setPromoting] = useState(false);

  const [demoteInput, setDemoteInput] = useState('');
  const [demoteTarget, setDemoteTarget] = useState<{ user_id: number; name: string } | null>(null);
  const [demoteStatus, setDemoteStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [demoting, setDemoting] = useState(false);

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoteInput.trim()) return;
    setPromoting(true);
    setPromoteStatus(null);
    try {
      const { data } = await api.post('/api/admin/promote', { name_or_email: promoteInput.trim() });
      setPromoteStatus({ type: 'success', msg: data.message });
      setPromoteInput('');
    } catch (err: any) {
      setPromoteStatus({ type: 'error', msg: err.response?.data?.message || 'Promotion failed' });
    } finally {
      setPromoting(false);
    }
  };

  const handleDemote = async () => {
    if (!demoteTarget) return;
    if (!window.confirm(`Demote ${demoteTarget.name} back to their original role?`)) return;
    setDemoting(true);
    setDemoteStatus(null);
    try {
      const { data } = await api.post(`/api/admin/demote/${demoteTarget.user_id}`);
      setDemoteStatus({ type: 'success', msg: data.message });
      setDemoteInput('');
      setDemoteTarget(null);
    } catch (err: any) {
      setDemoteStatus({ type: 'error', msg: err.response?.data?.message || 'Demotion failed' });
    } finally {
      setDemoting(false);
    }
  };

  // For demote: search by name or email to get user_id first
  const handleDemoteLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoteInput.trim()) return;
    setDemoteStatus(null);
    try {
      // Re-use the users endpoint and filter client-side
      const { data } = await api.get('/api/admin/users');
      const match = data.find((u: any) =>
        (u.name === demoteInput.trim() || u.email === demoteInput.trim()) && u.role === 'admin'
      );
      if (!match) {
        setDemoteStatus({ type: 'error', msg: 'No admin found with that name or email' });
        setDemoteTarget(null);
      } else {
        setDemoteTarget({ user_id: match.user_id, name: match.name });
        setDemoteStatus(null);
      }
    } catch (err) {
      setDemoteStatus({ type: 'error', msg: 'Failed to search users' });
    }
  };

  const card = (children: React.ReactNode, accent = 'rgba(255,255,255,0.08)') => (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: `1px solid ${accent}`,
      borderRadius: '14px', padding: '24px', marginBottom: '20px',
    }}>
      {children}
    </div>
  );

  const statusBanner = (s: { type: 'success' | 'error'; msg: string }) => (
    <div style={{
      marginTop: '12px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
      background: s.type === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
      color: s.type === 'success' ? '#22c55e' : '#ef4444',
      border: `1px solid ${s.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
    }}>
      {s.type === 'success' ? '✅' : '❌'} {s.msg}
    </div>
  );

  return (
    <div style={{ maxWidth: '600px' }}>
      <h2 style={{ marginBottom: '24px', fontSize: '18px', fontWeight: 800 }}>🛡️ Admin Control</h2>

      {/* Badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.3)',
        borderRadius: '8px', padding: '8px 14px', marginBottom: '24px',
      }}>
        <span style={{ color: '#FACC15', fontWeight: 800, fontSize: '13px' }}>
          🔑 Your Access Level: {access_level}
        </span>
        <span style={{ color: '#9ca3af', fontSize: '12px' }}>
          {access_level === 99 ? '(Super Admin)' : access_level >= 1 ? '(Can Promote)' : '(Read Only)'}
        </span>
      </div>

      {/* Promote Section — level >= 1 */}
      {access_level >= 1 && card(
        <>
          <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 800, color: '#22c55e' }}>
            ⬆️ Promote User to Admin (Level 1)
          </h3>
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: '0 0 16px' }}>
            Enter the name or email of a rider or driver to promote them to an admin account.
          </p>
          <form onSubmit={handlePromote} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="Name or email..."
              value={promoteInput}
              onChange={e => setPromoteInput(e.target.value)}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: '8px', fontSize: '14px',
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff', outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={promoting || !promoteInput.trim()}
              style={{
                padding: '10px 20px', borderRadius: '8px', border: 'none',
                background: !promoteInput.trim() ? '#374151' : '#22c55e',
                color: !promoteInput.trim() ? '#6b7280' : '#000',
                fontWeight: 800, fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {promoting ? 'Promoting...' : 'Promote'}
            </button>
          </form>
          {promoteStatus && statusBanner(promoteStatus)}
        </>
      )}

      {/* Demote Section — level 99 only */}
      {access_level === 99 && card(
        <>
          <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 800, color: '#ef4444' }}>
            ⬇️ Demote Admin Back to User
          </h3>
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: '0 0 16px' }}>
            Search for an admin by name or email, then demote them back to their original role.
          </p>
          <form onSubmit={handleDemoteLookup} style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <input
              type="text"
              placeholder="Admin name or email..."
              value={demoteInput}
              onChange={e => { setDemoteInput(e.target.value); setDemoteTarget(null); }}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: '8px', fontSize: '14px',
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff', outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '10px 20px', borderRadius: '8px', border: 'none',
                background: '#374151', color: '#d1d5db',
                fontWeight: 800, fontSize: '14px', cursor: 'pointer',
              }}
            >
              Search
            </button>
          </form>

          {demoteTarget && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: '10px', padding: '12px 16px',
            }}>
              <div>
                <div style={{ fontWeight: 800, color: '#fff' }}>{demoteTarget.name}</div>
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>ID: {demoteTarget.user_id}</div>
              </div>
              <button
                onClick={handleDemote}
                disabled={demoting}
                style={{
                  padding: '8px 18px', borderRadius: '8px', border: 'none',
                  background: '#ef4444', color: '#fff',
                  fontWeight: 800, fontSize: '13px', cursor: 'pointer',
                }}
              >
                {demoting ? 'Demoting...' : 'Confirm Demote'}
              </button>
            </div>
          )}

          {demoteStatus && statusBanner(demoteStatus)}
        </>
      )}

      {/* Level 0 message */}
      {access_level === 0 && (
        <div style={{
          padding: '20px', borderRadius: '12px', textAlign: 'center',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          color: '#6b7280', fontSize: '14px',
        }}>
          🔒 Your admin level (0) does not include promotion or demotion permissions.
        </div>
      )}
    </div>
  );
}
