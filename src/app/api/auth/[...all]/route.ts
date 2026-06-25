import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/server/auth/auth';

// Punto de entrada de todos los endpoints de autenticación (sign-up/in/out, OTP,
// OAuth callbacks, organización, admin). Better Auth resuelve el sub-path.
export const { GET, POST } = toNextJsHandler(auth);
