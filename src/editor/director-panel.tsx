import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Mic, Send, Sparkles, X } from 'lucide-react';
import { Button, GlassPanel } from '@/components/ui/primitives';
import styles from './editor.module.css';

type DirectorPanelProps = { open: boolean; onOpenChange: (open: boolean) => void; context: string; onAction: (action: unknown) => string };
type Message = { role: 'director' | 'codex'; text: string };
type StreamEvent = { type: 'thread' | 'delta' | 'message' | 'action' | 'done' | 'error'; threadId?: string; text?: string; message?: string; action?: unknown };
type SpeechResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionInstance = { lang: string; interimResults: boolean; onresult: ((event: SpeechResult) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function recognitionConstructor(): SpeechRecognitionConstructor | undefined {
  const browser = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
  return browser.SpeechRecognition || browser.webkitSpeechRecognition;
}

export function DirectorPanel({ open, onOpenChange, context, onAction }: DirectorPanelProps) {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [micAvailable, setMicAvailable] = useState(false);
  const [error, setError] = useState('');
  const threadId = useRef<string | null>(null);
  const recognition = useRef<SpeechRecognitionInstance | null>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => { setMicAvailable(!!recognitionConstructor()); return () => recognition.current?.stop(); }, []);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages, busy, error]);

  async function sendPrompt(text: string) {
    const prompt = text.trim();
    if (!prompt || busy) return;
    setDraft('');
    setError('');
    setBusy(true);
    setMessages(previous => [...previous, { role: 'director', text: prompt }, { role: 'codex', text: '' }]);
    const updateReply = (reply: string) => setMessages(previous => previous.map((message, index) => index === previous.length - 1 ? { role: 'codex', text: reply } : message));
    let reply = '';
    let pendingAction: unknown = null;
    try {
      const response = await fetch('/api/director', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, threadId: threadId.current, context }) });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(detail.error || `Codex request failed (${response.status}).`);
      }
      if (!response.body) throw new Error('Codex did not return a stream.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let completed = false;
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === 'thread' && event.threadId) threadId.current = event.threadId;
          else if (event.type === 'delta') { reply += event.text || ''; updateReply(reply); }
          else if (event.type === 'message') { reply = event.text || reply; updateReply(reply); }
          else if (event.type === 'action') pendingAction = event.action;
          else if (event.type === 'done') {
            reply = event.text || reply;
            if (pendingAction === null) throw new Error('Codex did not provide a scene command.');
            const result = onAction(pendingAction);
            if (result !== 'No scene change requested.') reply = `${reply}\n\n✓ ${result}`;
            updateReply(reply);
            completed = true;
          }
          else if (event.type === 'error') throw new Error(event.message || 'Codex could not finish this turn.');
        }
        if (done) break;
      }
      if (!completed) throw new Error('Codex stopped before completing its reply.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not connect to Codex.');
      if (!reply) setMessages(previous => previous.slice(0, -1));
      threadId.current = null;
    } finally { setBusy(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void sendPrompt(draft); }

  function toggleVoice() {
    if (listening) { recognition.current?.stop(); return; }
    const SpeechRecognition = recognitionConstructor();
    if (!SpeechRecognition) { setError('Voice input is not supported in this browser.'); return; }
    const instance = new SpeechRecognition();
    recognition.current = instance;
    instance.lang = 'en-US';
    instance.interimResults = false;
    instance.onresult = event => { const text = event.results[0]?.[0]?.transcript?.trim(); if (text) void sendPrompt(text); };
    instance.onerror = () => { setError('Microphone input failed. You can type a direction instead.'); setListening(false); };
    instance.onend = () => setListening(false);
    setError('');
    setListening(true);
    try { instance.start(); } catch { setListening(false); setError('Could not start microphone input.'); }
  }

  if (!open) return <Button className={styles.directorLauncher} variant="primary" onClick={() => onOpenChange(true)} aria-label="Open director panel"><Sparkles size={16} /> Director</Button>;

  return <GlassPanel className={styles.directorPanel} density="dense" role="region" aria-label="Director panel">
    <div className={styles.directorHeading}>
      <div className={styles.directorTitle}><span className={styles.directorIcon}><Sparkles size={17} /></span><div><h2>Director</h2><p>Shape the scene with Codex</p></div></div>
      <Button variant="ghost" size="sm" iconOnly aria-label="Close director panel" onClick={() => onOpenChange(false)}><X size={16} /></Button>
    </div>
    {(messages.length > 0 || busy) && <div ref={log} className={styles.directorLog} role="log" aria-live="polite" aria-label="Codex feedback">
      {messages.map((message, index) => <div key={index} className={message.role === 'director' ? styles.directorUserMessage : styles.directorAgentMessage}><strong>{message.role === 'director' ? 'You' : 'Codex'}</strong><p>{message.text || (busy ? 'Thinking…' : '')}</p></div>)}
    </div>}
    {error && <p className={styles.directorError} role="alert">{error}</p>}
    <form className={styles.directorComposer} onSubmit={submit}>
      <label className="sr-only" htmlFor="director-prompt">Direction for Codex</label>
      <textarea id="director-prompt" value={draft} onChange={event => setDraft(event.target.value)} placeholder="e.g. Orbit behind the subject, then reveal the pavilion" rows={2} maxLength={4000} disabled={busy} />
      <div className={styles.directorComposerActions}>
        <span>{listening ? 'Listening…' : busy ? 'Codex is responding…' : 'Direct your scene'}</span>
        <div><Button variant="ghost" size="sm" iconOnly aria-label={listening ? 'Stop listening' : 'Speak a direction'} aria-pressed={listening} title={micAvailable ? 'Speak a direction' : 'Voice input is unavailable in this browser'} disabled={!micAvailable || busy} onClick={toggleVoice}><Mic size={17} /></Button><Button variant="primary" size="sm" aria-label="Send direction" disabled={busy || !draft.trim()} type="submit"><Send size={15} /> Send</Button></div>
      </div>
    </form>
  </GlassPanel>;
}
