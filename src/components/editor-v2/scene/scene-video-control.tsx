'use client';
import { useEffect, useImperativeHandle, type RefObject } from 'react';
import type { NativeVideoMode } from '@/lib/editor-document/native-video';
import type { VideoPresentationOptions } from './construction-audio';

export interface SceneVideoControl {
  create: (mode: NativeVideoMode, options: VideoPresentationOptions) => Promise<void>;
  cancel: () => void;
}
export interface SceneVideoStatus {
  ready: boolean; busy: boolean; progress: number; siteReady: boolean;
  message: string | null; previewUrl: string | null;
}
export interface VideoStudioScene {
  mode: NativeVideoMode;
  contentScope?: import('@/lib/editor-document/video-content-scope').VideoContentScope;
  controlRef: RefObject<SceneVideoControl | null>;
  onStatus: (status: SceneVideoStatus) => void;
}

/** El estudio usa el mismo grabador de la escena; no duplica exportación ni validaciones. */
export function SceneVideoControlBridge({ studio, status, create, cancel }: {
  studio: VideoStudioScene; status: SceneVideoStatus;
  create: SceneVideoControl['create']; cancel: () => void;
}) {
  const { controlRef, onStatus } = studio;
  useImperativeHandle(controlRef, () => ({ create, cancel }), [create, cancel]);
  const { ready, busy, progress, siteReady, message, previewUrl } = status;
  useEffect(() => onStatus({ ready, busy, progress, siteReady, message, previewUrl }),
    [onStatus, ready, busy, progress, siteReady, message, previewUrl]);
  return null;
}
