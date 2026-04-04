import { useState, useEffect } from 'react';
import api from '../../api/axios';

interface Review {
  rating: number;
  comment: string | null;
  created_at: string;
  author_name: string;
}

interface ProfileData {
  user_id: number;
  name: string;
  role: string;
  avg_rating: string | null;
  review_count: number;
  reviews: Review[];
  has_reviewed: boolean;
}

interface ReviewModalProps {
  userId: number;
  rideId?: number;
  rideStatus?: string;
  onClose: () => void;
}

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: 'flex', gap: '4px', fontSize: '28px', cursor: onChange ? 'pointer' : 'default' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          onMouseEnter={() => onChange && setHovered(star)}
          onMouseLeave={() => onChange && setHovered(0)}
          onClick={(e) => {
            e.stopPropagation();
            if (onChange) {
              onChange(star);
            }
          }}
          style={{
            color: star <= (hovered || value) ? '#FACC15' : '#4b5563',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            userSelect: 'none',
            transform: hovered === star ? 'scale(1.2)' : 'scale(1)',
            display: 'inline-block',
            padding: '0 2px'
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export default function ReviewModal({ userId, rideId, rideStatus, onClose }: ReviewModalProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const canReview = rideStatus === 'completed' && rideId && !profile?.has_reviewed && !submitted;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const url = rideId
          ? `/api/rides/profile/${userId}?rideId=${rideId}`
          : `/api/rides/profile/${userId}`;
        const { data } = await api.get<ProfileData>(url);
        setProfile(data);
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [userId, rideId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmitReview = async () => {
    if (!rideId || rating === 0) return;
    setError('');
    setSubmitting(true);
    try {
      await api.post(`/api/rides/review/${rideId}`, { rating, comment: comment.trim() || undefined });
      setSubmitted(true);
      setProfile(prev => prev ? { ...prev, has_reviewed: true } : prev);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1a1a2e', border: '1px solid #2d2d4e',
          borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '440px',
          maxHeight: '85vh', overflowY: 'auto',
          boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading profile...</div>
        ) : !profile ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>Failed to load profile.</div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
                {canReview ? `Rate ${profile.name}` : `${profile.name}'s Profile`}
              </h2>
              <button 
                onClick={onClose}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '18px', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                title="Close"
              >✕</button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '32px', padding: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>{profile.role === 'driver' ? '🚗' : '👤'}</div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: 800, color: '#fff' }}>{profile.name}</h3>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                {profile.avg_rating ? (
                  <>
                    <span style={{ fontSize: '24px', fontWeight: 900, color: '#FACC15' }}>⭐ {parseFloat(profile.avg_rating).toFixed(1)}</span>
                    <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 500 }}>({profile.review_count} reviews)</span>
                  </>
                ) : (
                  <span style={{ color: '#64748b', fontSize: '14px', fontWeight: 600 }}>No ratings yet</span>
                )}
              </div>
            </div>

            {/* Review Form */}
            {canReview && (
              <div style={{
                background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: '12px', padding: '18px', marginBottom: '20px',
              }}>
                <div style={{ color: '#22c55e', fontWeight: 800, fontSize: '14px', marginBottom: '12px' }}>
                  ✍️ Leave a Review
                </div>
                <StarRating value={rating} onChange={setRating} />
                {rating === 0 && <p style={{ color: '#6b7280', fontSize: '12px', margin: '8px 0 0' }}>Click a star to rate</p>}
                <textarea
                  placeholder="Add a comment (optional)..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%', marginTop: '12px', padding: '10px 12px',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid #2d2d4e',
                    borderRadius: '8px', color: '#fff', resize: 'none', fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
                {error && <p style={{ color: '#ef4444', fontSize: '13px', margin: '8px 0 0' }}>{error}</p>}
                <button
                  onClick={handleSubmitReview}
                  disabled={rating === 0 || submitting}
                  className="submit-review-btn"
                  style={{
                    marginTop: '12px', width: '100%', padding: '14px',
                    background: rating === 0 ? '#1f2937' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                    color: rating === 0 ? '#4b5563' : '#000',
                    border: rating === 0 ? '1px solid #374151' : 'none',
                    borderRadius: '12px', fontWeight: 800, fontSize: '15px',
                    cursor: rating === 0 || submitting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: rating === 0 ? 'none' : '0 10px 15px -3px rgba(22, 163, 74, 0.2)',
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <span className="spinner" style={{ width: '16px', height: '16px', border: '2px solid rgba(0,0,0,0.1)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Submitting...
                    </span>
                  ) : (
                    rating === 0 ? 'Select a Rating' : 'Submit Review'
                  )}
                </button>
              </div>
            )}

            {submitted && (
              <div style={{
                background: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e',
                borderRadius: '10px', padding: '14px', marginBottom: '20px',
                color: '#22c55e', fontWeight: 700, textAlign: 'center', fontSize: '14px',
              }}>
                ✅ Review submitted! Thank you.
              </div>
            )}

            {profile.has_reviewed && !submitted && rideId && (
              <div style={{
                background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.3)',
                borderRadius: '10px', padding: '12px', marginBottom: '20px',
                color: '#FACC15', fontWeight: 600, textAlign: 'center', fontSize: '13px',
              }}>
                ⭐ You've already reviewed this ride.
              </div>
            )}

            {/* Recent Reviews */}
            <div>
              <div style={{ color: '#9ca3af', fontWeight: 800, fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>
                Recent Reviews
              </div>
              {profile.reviews.length === 0 ? (
                <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                  No reviews yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {profile.reviews.map((rev, i) => (
                    <div
                      key={i}
                      style={{
                        background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '14px',
                        border: '1px solid #2d2d4e',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <StarRating value={rev.rating} />
                          <span style={{ color: '#FACC15', fontWeight: 700, fontSize: '13px' }}>{rev.rating}/5</span>
                        </div>
                        <span style={{ color: '#6b7280', fontSize: '12px' }}>
                          {new Date(rev.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {rev.comment && (
                        <p style={{ margin: '0 0 6px', color: '#d1d5db', fontSize: '13px', lineHeight: 1.5 }}>
                          "{rev.comment}"
                        </p>
                      )}
                      <span style={{ color: '#6b7280', fontSize: '12px' }}>— {rev.author_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
