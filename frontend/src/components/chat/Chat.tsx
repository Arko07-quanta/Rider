import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
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
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let socket: Socket;

    if (isOpen) {
      fetchMessages();
      
      socket = io(import.meta.env.VITE_API_URL || 'http://localhost:4000', {
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
        <div className="chat-header-left" onClick={() => setIsOpen(!isOpen)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <h4 style={{ margin: 0 }}>💬 Chat with {theirName}</h4>
          <span className="toggle-icon">{isOpen ? '▼' : '▲'}</span>
        </div>
        {theirUserId && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowProfile(true); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '0 4px' }}
            title={`View ${theirName}'s profile`}
          >👤</button>
        )}
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
