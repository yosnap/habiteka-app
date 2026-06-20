'use client';

/**
 * Chat de cualificación: compone el historial, la entrada y los atajos de estilo
 * y de entregables. Dispara las acciones del agente (server-side) y refleja sus
 * respuestas. No contiene lógica de IA: solo presenta y delega.
 */
import { useState, useTransition } from 'react';
import { MessageList, type ChatTurn } from './message-list';
import { MessageInput } from './message-input';
import { StyleQuickPicks } from './style-quick-picks';
import { DeliverablePicker } from './deliverable-picker';
import type { AgentInput, AgentOutcome } from '@/server/agent';
import type { Estilo, DeliverableType, ChatMessage } from '@/lib/contracts';

interface Props {
  projectId: string;
  advance: (projectId: string, input: AgentInput) => Promise<AgentOutcome>;
}

let turnSeq = 0;

export function QualificationChat({ projectId, advance }: Props) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pending, startTransition] = useTransition();

  const pushTurn = (role: 'user' | 'assistant', text: string) =>
    setTurns((prev) => [...prev, { id: `t${++turnSeq}`, role, text }]);

  const sendQualify = (history: ChatMessage[], echo: string) => {
    pushTurn('user', echo);
    startTransition(async () => {
      const out = await advance(projectId, { action: 'qualify', history });
      const summary = describeCollected(out);
      if (summary) pushTurn('assistant', summary);
    });
  };

  const onSend = (text: string) =>
    sendQualify([{ role: 'user', content: [{ type: 'text', text }] }], text);

  const onPickStyle = (estilo: Estilo) =>
    sendQualify(
      [{ role: 'user', content: [{ type: 'text', text: `Estilo: ${estilo}` }] }],
      `Estilo: ${estilo}`,
    );

  const onPickDeliverables = (types: DeliverableType[]) =>
    sendQualify(
      [{ role: 'user', content: [{ type: 'text', text: `Entregables: ${types.join(', ')}` }] }],
      `Entregables: ${types.join(', ')}`,
    );

  return (
    <div className="flex h-full flex-col gap-3">
      <MessageList turns={turns} streamingText="" />
      <div className="flex flex-col gap-2">
        <StyleQuickPicks onPick={onPickStyle} />
        <DeliverablePicker onConfirm={onPickDeliverables} />
        <MessageInput onSend={onSend} disabled={pending} />
      </div>
    </div>
  );
}

function describeCollected(out: AgentOutcome): string {
  const c = out.collected;
  const parts: string[] = [];
  if (c.estilo) parts.push(`estilo ${c.estilo}`);
  if (c.entregables.length) parts.push(`entregables ${c.entregables.join(', ')}`);
  return parts.length ? `Anotado: ${parts.join(' · ')}.` : '';
}
