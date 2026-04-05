import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { config } from '../../config';
import api from '../../api/axios';
import ReviewModal from '../reviews/ReviewModal';
import './Chat.css';

interface ChatMessage {
  message_id: string;
  sender_id: string;
  message_text: string;
  sent_at: string;
  is_read: boolean;
  sender_name: string;
}

interface ChatProps {
  rideId: number;
  theirName: string;
  theirUserId?: number;
  rideStatus?: string;
}

export default function Chat({ rideId, theirName, theirUserId, rideStatus }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [avgRating, setAvgRating] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (theirUserId) {
      api.get(`/api/rides/profile/${theirUserId}`).then(({ data }) => {
        setAvgRating(data.avg_rating);
      }).catch(err => console.error('Error fetching rating', err));
    }
  }, [theirUserId]);

  useEffect(() => {
    let socket: Socket;

    if (isOpen) {
      fetchMessages();
      
      socket = io(config.API_URL, {
        withCredentials: true,
      });

      socket.on('connect', () => {
        socket.emit('join_ride', rideId);
      });

      socket.on('new_message', (message: ChatMessage) => {
        setMessages(prev => {
          if (!prev.find(m => m.message_id === message.message_id)) {
            return [...prev, message];
          }
          return prev;
        });
      });
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [isOpen, rideId]);

  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const fetchMessages = async () => {
    try {
      const { data } = await api.get(`/api/chat/${rideId}`);
      setMessages(data);
    } catch (err) {
      console.error('Fetch chat error', err);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await api.post('/api/chat/send', { ride_id: rideId, message_text: newMessage });
      setNewMessage('');
      // No need to call fetchMessages() — the socket 'new_message' event adds it automatically
    } catch (err) {
      console.error('Send error', err);
    }
  };

  return (
    <div className={`chat-widget ${isOpen ? 'open' : 'closed'}`}>
      <div className="chat-header">
        <div
          className="chat-header-profile"
          onClick={() => setShowProfile(true)}
          title={`View ${theirName}'s profile & reviews`}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        >
          <div className="avatar-circle">👤</div>
          <div className="profile-info-mini">
            <h4 style={{ margin: 0, fontSize: '14px' }}>{theirName}</h4>
            {avgRating ? (
              <div className="rating-mini">⭐ {avgRating}</div>
            ) : (
              <div className="no-rating-mini">New User</div>
            )}
          </div>
        </div>
        <div 
          className="chat-header-toggle" 
          onClick={() => setIsOpen(!isOpen)}
          style={{ padding: '8px', cursor: 'pointer', transition: 'var(--transition)' }}
        >
          <span className="toggle-icon">{isOpen ? '▼' : '▲'}</span>
        </div>
      </div>

      {showProfile && theirUserId && (
        <ReviewModal
          userId={theirUserId}
          rideId={rideId}
          rideStatus={rideStatus}
          onClose={() => setShowProfile(false)}
        />
      )}
      
      {isOpen && (
        <div className="chat-body">
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="no-msgs">No messages yet. Say hi!</div>
            ) : (
              messages.map(msg => {
                const isMe = msg.sender_name !== theirName;
                return (
                  <div key={msg.message_id} className={`message ${isMe ? 'mine' : 'theirs'}`}>
                    <div className="msg-bubble">{msg.message_text}</div>
                    <span className="msg-time">{new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                );
              })
            )}
            <div ref={endRef} />
          </div>
          
          <form className="chat-input-form" onSubmit={handleSend}>
            <input 
              type="text" 
              placeholder="Message..." 
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
            />
            <button type="submit" disabled={!newMessage.trim()}>Send</button>
          </form>
        </div>
      )}
    </div>
  );
}
