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
          onClick={() => onChange?.(star)}
          style={{
            color: star <= (hovered || value) ? '#FACC15' : '#4b5563',
            transition: 'color 0.15s',
            userSelect: 'none',
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
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 800 }}>👤 Profile</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}
          >✕</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>Loading profile...</div>
        ) : !profile ? (
          <div style={{ textAlign: 'center', color: '#ef4444', padding: '40px 0' }}>Failed to load profile.</div>
        ) : (
          <>
            {/* Profile Info */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '16px', marginBottom: '20px',
            }}>
              <div style={{
                width: '52px', height: '52px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px', flexShrink: 0,
              }}>
                {profile.role === 'driver' ? '🚗' : '🧑'}
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: '17px' }}>{profile.name}</div>
                <div style={{ color: '#9ca3af', fontSize: '13px', textTransform: 'capitalize', marginBottom: '4px' }}>{profile.role}</div>
                {profile.avg_rating ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <StarRating value={Math.round(parseFloat(profile.avg_rating))} />
                    <span style={{ color: '#FACC15', fontWeight: 700, fontSize: '14px' }}>{profile.avg_rating}</span>
                    <span style={{ color: '#6b7280', fontSize: '12px' }}>({profile.review_count} reviews)</span>
                  </div>
                ) : (
                  <div style={{ color: '#6b7280', fontSize: '13px' }}>No ratings yet</div>
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
                  style={{
                    marginTop: '12px', width: '100%', padding: '11px',
                    background: rating === 0 ? '#374151' : '#22c55e',
                    color: rating === 0 ? '#6b7280' : '#000',
                    border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: '14px',
                    cursor: rating === 0 || submitting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {submitting ? 'Submitting...' : 'Submit Review'}
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
