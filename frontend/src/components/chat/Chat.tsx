import { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import './Chat.css';

interface ChatMessage {
  message_id: string;
  sender_id: string;
  message_text: string;
  sent_at: string;
  is_read: boolean;
  sender_name: string;
}

export default function Chat({ rideId, theirName }: { rideId: number, theirName: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isOpen) {
      fetchMessages();
      interval = setInterval(fetchMessages, 3000);
    }
    return () => clearInterval(interval);
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
      fetchMessages();
    } catch (err) {
      console.error('Send error', err);
    }
  };

  return (
    <div className={`chat-widget ${isOpen ? 'open' : 'closed'}`}>
      <div className="chat-header" onClick={() => setIsOpen(!isOpen)}>
        <h4>💬 Chat with {theirName}</h4>
        <span className="toggle-icon">{isOpen ? '▼' : '▲'}</span>
      </div>
      
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
