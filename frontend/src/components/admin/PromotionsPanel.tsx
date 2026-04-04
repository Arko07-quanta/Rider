import { useEffect, useState } from "react";
import api from "../../api/axios";

interface Promotion {
  promo_id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  value: number;
  min_fare_amount: number;
  max_discount_amount: number | null;
  usage_limit: number | null;
  expiry_date: string | null;
  is_active: boolean;
  target_min_distance: number;
  target_min_rides: number;
  target_min_spend: number;
  target_app_age_days: number;
  is_public: boolean;
  created_at: string;
}

export default function PromotionsPanel() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Partial<Promotion> | null>(null);
  const [form, setForm] = useState<Partial<Promotion>>({
    code: '',
    discount_type: 'percentage',
    value: 0,
    min_fare_amount: 0,
    max_discount_amount: null,
    usage_limit: null,
    expiry_date: '',
    is_active: true,
    target_min_distance: 0,
    target_min_rides: 0,
    target_min_spend: 0,
    target_app_age_days: 0,
    is_public: false
  });

  const fetchPromotions = async () => {
    try {
      const res = await api.get("/api/admin/coupons");
      setPromotions(res.data);
    } catch (err) {
      console.error("Failed to fetch promotions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  useEffect(() => {
    if (!showModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModal(false);
        setEditingPromo(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPromo?.promo_id) {
        await api.put(`/api/admin/coupons/${editingPromo.promo_id}`, form);
      } else {
        await api.post("/api/admin/coupons", form);
      }
      setShowModal(false);
      setEditingPromo(null);
      fetchPromotions();
    } catch (err: any) {
      alert(err.response?.data?.message || "Action failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this promotion?")) return;
    try {
      await api.delete(`/api/admin/coupons/${id}`);
      fetchPromotions();
    } catch (err) {
      console.error("Delete failed");
    }
  };

  const openEdit = (promo: Promotion) => {
    setEditingPromo(promo);
    setForm({
      ...promo,
      expiry_date: promo.expiry_date ? promo.expiry_date.split('T')[0] : ''
    });
    setShowModal(true);
  };

  const openAdd = () => {
    setEditingPromo(null);
    setForm({
      code: '',
      discount_type: 'percentage',
      value: 0,
      min_fare_amount: 0,
      max_discount_amount: null,
      usage_limit: null,
      expiry_date: '',
      is_active: true,
      target_min_distance: 0,
      target_min_rides: 0,
      target_min_spend: 0,
      target_app_age_days: 0,
      is_public: false
    });
    setShowModal(true);
  };

  return (
    <div className="panel-content animated fadeIn">
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Promotions & Coupons</h2>
        <button className="confirm-btn" style={{ width: 'auto', margin: 0 }} onClick={openAdd}>+ Create New Coupon</button>
      </div>

      {loading ? <p>Loading...</p> : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Type</th>
              <th>Value</th>
              <th>Min Fare</th>
              <th>Limit/Expiry</th>
              <th>Give Condition</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {promotions.map(promo => (
              <tr key={promo.promo_id}>
                <td style={{ fontWeight: 800, color: 'var(--color-primary)' }}>{promo.code}</td>
                <td>{promo.discount_type}</td>
                <td>{promo.discount_type === 'percentage' ? `${promo.value}%` : `$${promo.value}`}</td>
                <td>${promo.min_fare_amount}</td>
                <td style={{ fontSize: '12px' }}>
                   {promo.usage_limit ? `Limit: ${promo.usage_limit}` : 'No limit'}<br/>
                   {promo.expiry_date ? `Exp: ${new Date(promo.expiry_date).toLocaleDateString()}` : 'No expiry'}
                </td>
                <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {promo.is_public ? (
                    <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>📢 BROADCAST</span>
                  ) : (
                    <>
                      {promo.target_min_rides > 0 && <div>• {promo.target_min_rides} rides</div>}
                      {promo.target_min_distance > 0 && <div>• {promo.target_min_distance} km</div>}
                      {promo.target_min_spend > 0 && <div>• ${promo.target_min_spend} spent</div>}
                      {promo.target_app_age_days > 0 && <div>• {promo.target_app_age_days} days old</div>}
                      {!(promo.target_min_rides || promo.target_min_distance || promo.target_min_spend || promo.target_app_age_days) && 'Manual only'}
                    </>
                  )}
                </td>
                <td>
                  <span className={`status-badge ${promo.is_active ? 'active' : 'inactive'}`}>
                    {promo.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button className="action-btn-edit" onClick={() => openEdit(promo)}>Edit</button>
                  <button className="action-btn-delete" onClick={() => handleDelete(promo.promo_id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '450px' }}>
             <div className="modal-header">
                <h3>{editingPromo ? 'Edit Promotion' : 'Create New Promotion'}</h3>
                <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
             </div>
             <form onSubmit={handleSubmit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="input-field">
                  <label>Promo Code</label>
                  <input required value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} placeholder="e.g. SAVE50" />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div className="input-field" style={{ flex: 1 }}>
                    <label>Discount Type</label>
                    <select value={form.discount_type} onChange={e => setForm({...form, discount_type: e.target.value as any})}>
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed Amount</option>
                    </select>
                  </div>
                  <div className="input-field" style={{ flex: 1 }}>
                    <label>Value ({form.discount_type === 'percentage' ? '%' : '$'})</label>
                    <input type="number" required value={form.value} onChange={e => setForm({...form, value: Number(e.target.value)})} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div className="input-field" style={{ flex: 1 }}>
                    <label>Min Fare ($)</label>
                    <input type="number" value={form.min_fare_amount} onChange={e => setForm({...form, min_fare_amount: Number(e.target.value)})} />
                  </div>
                  <div className="input-field" style={{ flex: 1 }}>
                    <label>Max Discount ($)</label>
                    <input type="number" value={form.max_discount_amount || ''} onChange={e => setForm({...form, max_discount_amount: e.target.value ? Number(e.target.value) : null})} placeholder="Optional" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div className="input-field" style={{ flex: 1 }}>
                    <label>Usage Limit</label>
                    <input type="number" value={form.usage_limit || ''} onChange={e => setForm({...form, usage_limit: e.target.value ? Number(e.target.value) : null})} placeholder="Optional" />
                  </div>
                  <div className="input-field" style={{ flex: 1 }}>
                    <label>Expiry Date</label>
                    <input type="date" value={form.expiry_date || ''} onChange={e => setForm({...form, expiry_date: e.target.value})} />
                  </div>
                </div>

                <div className="form-divider" style={{ margin: '8px 0', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>Automatic Reward Conditions</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="input-field">
                      <label>Min Rides</label>
                      <input type="number" value={form.target_min_rides} onChange={e => setForm({...form, target_min_rides: Number(e.target.value)})} />
                    </div>
                    <div className="input-field">
                      <label>Min Distance (km)</label>
                      <input type="number" value={form.target_min_distance} onChange={e => setForm({...form, target_min_distance: Number(e.target.value)})} />
                    </div>
                    <div className="input-field">
                      <label>Min Spend ($)</label>
                      <input type="number" value={form.target_min_spend} onChange={e => setForm({...form, target_min_spend: Number(e.target.value)})} />
                    </div>
                    <div className="input-field">
                      <label>Min App Age (days)</label>
                      <input type="number" value={form.target_app_age_days} onChange={e => setForm({...form, target_app_age_days: Number(e.target.value)})} />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
                  <div className="input-field" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} id="is_active" />
                    <label htmlFor="is_active" style={{ margin: 0 }}>Active</label>
                  </div>
                  <div className="input-field" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" checked={form.is_public} onChange={e => setForm({...form, is_public: e.target.checked})} id="is_public" />
                    <label htmlFor="is_public" style={{ margin: 0, color: 'var(--color-primary)' }}>📢 Broadcast (Public)</label>
                  </div>
                </div>
                <button type="submit" className="confirm-btn">{editingPromo ? 'Save Changes' : 'Create Coupon'}</button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
