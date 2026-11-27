import { createServerFn } from '@tanstack/react-start';
import { getRequest, setResponseHeader } from '@tanstack/react-start/server';
import { z } from 'zod';
import { verifyCacadorSession } from './cacador-auth.server';
import { callCacadorMcpTool, listCacadorMcpTools } from './cacador-mcp.server';

export const getCacadorMcpTools = createServerFn({ method: 'GET' }).handler(async () => {
  setResponseHeader('Cache-Control', 'no-store');
  if (!await verifyCacadorSession(getRequest().headers)) throw new Error('Inicia sessão no Caçador.');
  return listCacadorMcpTools();
});

export const executeCacadorMcpTool = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => z.object({ serverId: z.string().min(1).max(40), toolName: z.string().min(1).max(100), arguments: z.record(z.string(), z.unknown()).default({}) }).parse(input))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store');
    if (!await verifyCacadorSession(getRequest().headers)) throw new Error('Inicia sessão no Caçador.');
    return callCacadorMcpTool(data);
  });