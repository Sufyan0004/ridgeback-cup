import { useEffect, useRef } from 'react';
import type { Message } from '../lib/ui';

export function Transcript({ messages, children }: { messages: Message[]; children?: React.ReactNode }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, children]);

  return (
    <div className="transcript" aria-live="polite" aria-label="Conversation with Hunter">
      {messages.map((m) => (
        <div key={m.id} className={`msg msg--${m.from}`}>
          {m.from === 'user' && m.viaVoice && <span className="msg__heard">I heard:</span>}
          <p>{m.text}</p>
        </div>
      ))}
      {children}
      <div ref={end} />
    </div>
  );
}
