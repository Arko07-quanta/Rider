import { useState } from 'react';
import api from '../../api/axios';

interface AdminControlPanelProps {
  access_level: number;
}

export default function AdminControlPanel({ access_level }: AdminControlPanelProps) {
  const [promoteInput, setPromoteInput] = useState('');
  const [targetLevel, setTargetLevel] = useState(1);
  const [promoteStatus, setPromoteStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [promoting, setPromoting] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [foundAdmin, setFoundAdmin] = useState<{ user_id: number; name: string; email: string; access_level: number } | null>(null);
  const [searchStatus, setSearchStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const [updating, setUpdating] = useState(false);

  const maxGrantableLevel = access_level === 99 ? 98 : access_level - 1;

  const handlePromoteOrUpdate = async (e: React.FormEvent, levelOverride?: number) => {
    e.preventDefault();
    const input = levelOverride !== undefined ? foundAdmin?.email : promoteInput;
    const level = levelOverride !== undefined ? levelOverride : targetLevel;
    
    if (!input?.trim()) return;
    
    setPromoting(true);
    setPromoteStatus(null);
    try {
      const { data } = await api.post('/api/admin/promote', { 
        name_or_email: input.trim(),
        target_level: level
      });
      setPromoteStatus({ type: 'success', msg: data.message });
      if (levelOverride === undefined) {
          setPromoteInput('');
      } else if (foundAdmin) {
          setFoundAdmin({ ...foundAdmin, access_level: level });
      }
    } catch (err: any) {
      setPromoteStatus({ type: 'error', msg: err.response?.data?.message || 'Action failed' });
    } finally {
      setPromoting(false);
    }
  };

  const handleDemote = async () => {
    if (!foundAdmin) return;
    if (!window.confirm(`Are you sure you want to remove admin privileges from ${foundAdmin.name}?`)) return;
    
    setUpdating(true);
    try {
      const { data } = await api.post(`/api/admin/demote/${foundAdmin.user_id}`);
      setPromoteStatus({ type: 'success', msg: data.message });
      setFoundAdmin(null);
      setSearchInput('');
    } catch (err: any) {
      setPromoteStatus({ type: 'error', msg: err.response?.data?.message || 'Demotion failed' });
    } finally {
      setUpdating(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    
    setSearching(true);
    setSearchStatus(null);
    setFoundAdmin(null);
    
    try {
      const { data } = await api.get('/api/admin/users');
      // The /users endpoint doesn't return access_level from the JOIN by default in the basic GET /users
      // but my new backend changes might need to facilitate this.
      // Wait, let's check backend /users route.
      const match = data.find((u: any) =>
        (u.name.toLowerCase() === searchInput.trim().toLowerCase() || u.email.toLowerCase() === searchInput.trim().toLowerCase())
      );
      
      if (!match) {
        setSearchStatus({ type: 'error', msg: 'User not found' });
      } else if (match.role !== 'admin') {
        setSearchStatus({ type: 'error', msg: 'User found but they are not an admin. Use the promotion tool above.' });
      } else {
        // Fetch specific admin details or just use the match if we update the backend /users
        // For now, let's assume we need to fetch their level or match has it.
        // I'll update GET /users to include access_level.
        setFoundAdmin(match);
      }
    } catch (err) {
      setSearchStatus({ type: 'error', msg: 'Search failed' });
    } finally {
      setSearching(false);
    }
  };

  const banner = (s: { type: 'success' | 'error'; msg: string }) => (
    <div className={`status-banner ${s.type}`} style={{
      marginTop: '16px', padding: '12px 16px', borderRadius: 'var(--radius-sm)',
      fontSize: '14px', fontWeight: 600,
      background: s.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
      color: s.type === 'success' ? 'var(--color-primary)' : '#ef4444',
      border: `1px solid ${s.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
    }}>
      {s.type === 'success' ? '✅' : '❌'} {s.msg}
    </div>
  );

  return (
    <div className="admin-control-container" style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>🛡️ Admin Oversight</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Manage administrative roles and authority levels across the platform.</p>
      </div>

      <div className="surface-card" style={{ marginBottom: '24px', border: '1px solid var(--color-primary)', background: 'rgba(34,197,94,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', background: 'rgba(34,197,94,0.1)', borderRadius: '50%' }}>🔑</div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Your Authority</div>
            <div style={{ fontSize: '18px', fontWeight: 800 }}>Level {access_level} {access_level === 99 ? '(Super Admin)' : ''}</div>
          </div>
        </div>
      </div>

      {/* Promotion Tool */}
      <div className="surface-card" style={{ marginBottom: '32px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800 }}>⬆️ Promote / Grant Authority</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
          Assign administrative levels to riders or drivers. You can grant any level up to <strong>{maxGrantableLevel}</strong>.
        </p>

        <form onSubmit={(e) => handlePromoteOrUpdate(e)} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px' }}>
          <div className="input-group">
            <input
              type="text"
              placeholder="Enter name or email..."
              value={promoteInput}
              onChange={e => setPromoteInput(e.target.value)}
              style={{ height: '48px' }}
            />
          </div>
          <div className="input-group">
            <select 
              value={targetLevel} 
              onChange={e => setTargetLevel(parseInt(e.target.value))}
              style={{ height: '48px', width: '120px' }}
            >
              {[...Array(maxGrantableLevel + 1).keys()].map(lvl => (
                <option key={lvl} value={lvl}>Level {lvl}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={promoting || !promoteInput.trim()}
            style={{ height: '48px', padding: '0 32px' }}
          >
            {promoting ? 'Processing...' : 'Grant Access'}
          </button>
        </form>
        {promoteStatus && banner(promoteStatus)}
      </div>

      {/* Management & Demotion Tool */}
      <div className="surface-card">
        <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800 }}>⬇️ Manage Existing Admins</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
          Search for current admins to adjust their authority or revoke access.
        </p>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <input
            type="text"
            placeholder="Search admin name or email..."
            value={searchInput}
            onChange={e => { setSearchInput(e.target.value); setFoundAdmin(null); }}
            style={{ height: '48px' }}
          />
          <button
            type="submit"
            className="btn-secondary"
            disabled={searching || !searchInput.trim()}
            style={{ height: '48px', width: '120px' }}
          >
            {searching ? '...' : 'Search'}
          </button>
        </form>

        {searchStatus && banner(searchStatus)}

        {foundAdmin && (
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)', padding: '24px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 800 }}>{foundAdmin.name}</div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{foundAdmin.email}</div>
                <div style={{ 
                  marginTop: '12px', display: 'inline-block', padding: '4px 12px', 
                  background: 'rgba(250,204,21,0.1)', color: '#FACC15', 
                  borderRadius: '20px', fontSize: '12px', fontWeight: 800 
                }}>
                  CURRENT LEVEL: {foundAdmin.access_level}
                </div>
              </div>
              <button 
                onClick={handleDemote}
                className="btn-secondary"
                disabled={updating || (foundAdmin.access_level >= access_level && access_level !== 99)}
                style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
              >
                Revoke All Access
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>Adjust Level</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[...Array(maxGrantableLevel + 1).keys()].filter(lvl => lvl !== foundAdmin.access_level).map(lvl => (
                  <button
                    key={lvl}
                    onClick={(e) => handlePromoteOrUpdate(e, lvl)}
                    className="btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    Set to Level {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {access_level === 0 && (
        <div style={{
          marginTop: '32px', padding: '24px', borderRadius: 'var(--radius-md)', textAlign: 'center',
          background: 'rgba(255,255,255,0.02)', border: '1px dotted var(--border-color)',
          color: 'var(--text-muted)', fontSize: '14px',
        }}>
          🔒 Your current level (0) provides read-only access to the control panel.
        </div>
      )}
    </div>
  );
}

