import { createServerFn } from '@tanstack/react-start';
import { getRequest, setResponseHeader } from '@tanstack/react-start/server';
import { z } from 'zod';
import { failedConnection } from './cacador-connection';
import { generateCacadorAnswer } from './cacador-ai.server';
import { verifyCacadorSession } from './cacador-auth.server';

const RequestSchema = z.object({ message: z.string().trim().min(1).max(4000), context: z.string().max(4000).optional() });
export const testCacadorAI = createServerFn({ method: 'POST' }).handler(async () => {
  setResponseHeader('Cache-Control', 'no-store');
  if (!await verifyCacadorSession(getRequest().headers)) return failedConnection('auth');
  return (await generateCacadorAnswer('Confirma a ligação.', '', true)).connection;
});
export const askCacadorAI = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => RequestSchema.parse(input))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store');
    if (!await verifyCacadorSession(getRequest().headers)) return { answer: '', connection: failedConnection('auth') };
    return generateCacadorAnswer(data.message, data.context);
  });
