'use client';

import { Component, type ReactNode } from 'react';

/**
 * Captura errores al cargar un modelo 3D (p. ej. un item custom sin .glb → 404 de
 * `/api/catalog/<kind>/model`, o un .glb corrupto) y renderiza el `fallback` en su lugar.
 *
 * `Suspense` solo captura promesas pendientes, NO errores: un `useGLTF(url)` que falla
 * lanzaría un error que rompería todo el Canvas. Este boundary aísla cada mueble para
 * que uno que no cargue caiga a su placeholder sin afectar al resto de la escena.
 */
interface Props {
  fallback: ReactNode;
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

export class ModelErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Aviso (no error) para no ensuciar la consola del usuario: el placeholder es suficiente.
    console.warn('Modelo 3D no cargado, usando placeholder:', error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
