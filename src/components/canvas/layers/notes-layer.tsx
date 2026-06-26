'use client';

/**
 * Capa de notas/anotaciones de texto en el plano 2D (B4). Cada nota es un sticky
 * amarillo con texto editable (doble-clic para editar, arrastrar para mover).
 * Se crean con la herramienta "Nota" (clic en el canvas).
 */
import { useState, useRef } from 'react';
import { Group, Rect, Text, Line } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '@/canvas/canvas-store';
import type { CanvasNote } from '@/canvas/types';

const NOTE_W = 160;
const NOTE_H = 80;
const NOTE_COLOR = '#fff9c4';
const NOTE_BORDER = '#fbc02d';

// Array vacío estable: `?? []` crea una referencia nueva en cada render → loop infinito
// en useSyncExternalStore (Zustand). Esta constante se reutiliza.
const EMPTY_NOTES: readonly CanvasNote[] = [];

export function NotesLayer() {
  const notes = useCanvasStore((s) => s.doc.notes ?? EMPTY_NOTES);
  const updateNote = useCanvasStore((s) => s.updateNote);
  const removeNote = useCanvasStore((s) => s.removeNote);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (notes.length === 0 && !editingId) return null;

  return (
    <>
      {notes.map((note) => (
        <NoteShape
          key={note.id}
          note={note}
          isEditing={editingId === note.id}
          onStartEdit={() => setEditingId(note.id)}
          onEndEdit={() => setEditingId(null)}
          onUpdate={(text) => updateNote(note.id, { text })}
          onDragEnd={(x, y) => updateNote(note.id, { x, y })}
          onDelete={() => removeNote(note.id)}
        />
      ))}
    </>
  );
}

function NoteShape({
  note,
  isEditing,
  onStartEdit,
  onEndEdit,
  onUpdate,
  onDragEnd,
  onDelete,
}: {
  note: CanvasNote;
  isEditing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
  onUpdate: (text: string) => void;
  onDragEnd: (x: number, y: number) => void;
  onDelete: () => void;
}) {
  const textRef = useRef<Konva.Text | null>(null);

  return (
    <Group
      x={note.x}
      y={note.y}
      draggable
      onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
      onDblClick={onStartEdit}
    >
      {/* Sombra */}
      <Rect x={2} y={3} width={NOTE_W} height={NOTE_H} fill="#00000020" cornerRadius={4} />
      {/* Cuerpo */}
      <Rect width={NOTE_W} height={NOTE_H} fill={note.color ?? NOTE_COLOR} stroke={NOTE_BORDER} strokeWidth={1} cornerRadius={4} />
      {/* Línea de cabecera (para arrastrar visualmente) */}
      <Line points={[0, 18, NOTE_W, 18]} stroke={NOTE_BORDER} strokeWidth={0.5} opacity={0.5} />
      {/* Texto */}
      <Text
        ref={textRef}
        x={6}
        y={22}
        width={NOTE_W - 12}
        height={NOTE_H - 28}
        text={note.text || 'Doble-clic para editar'}
        fontSize={12}
        fontStyle={note.text ? 'normal' : 'italic'}
        fill={note.text ? '#333' : '#999'}
        listening={!isEditing}
      />
      {/* Botón eliminar (esquina sup-der) */}
      <Text
        x={NOTE_W - 18}
        y={2}
        text="✕"
        fontSize={12}
        fill="#c62828"
        onMouseDown={(e) => { e.cancelBubble = true; onDelete(); }}
      />
      {isEditing ? (
        <Text
          x={6}
          y={22}
          width={NOTE_W - 12}
          height={NOTE_H - 28}
          text={note.text}
          fontSize={12}
          fill="#333"
          editable
          onTextChange={(e: Konva.KonvaEventObject<MouseEvent>) => onUpdate((e.target as Konva.Text).text())}
          onBlur={onEndEdit}
        />
      ) : null}
    </Group>
  );
}
