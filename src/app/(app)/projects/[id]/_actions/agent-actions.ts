'use server';

/**
 * Server Actions finas que conectan la UI con el orquestador del agente. No
 * contienen lógica de negocio ni prompts: resuelven la organización de la sesión,
 * crean la sesión de agente y delegan en `advance`. La IA y las guardas viven en
 * el servidor (F5/F3).
 */
import { requireOrgContext } from '@/server/auth/require-org-context';
import { getAgent, type AgentInput, type AgentOutcome } from '@/server/agent';

export async function advanceAgent(projectId: string, input: AgentInput): Promise<AgentOutcome> {
  const ctx = await requireOrgContext();
  const agent = await getAgent(ctx.organizationId, ctx.userId);
  return agent.advance(projectId, input);
}
