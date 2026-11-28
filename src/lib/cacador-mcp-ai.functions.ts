import { createServerFn } from '@tanstack/react-start';
import { getRequest, setResponseHeader } from '@tanstack/react-start/server';
import { z } from 'zod';
import { verifyCacadorSession } from './cacador-auth.server';
import { askCacadorWithMcp, askCacadorWhatsAppWithMcp } from './cacador-mcp-ai.server';

const AskSchema = z.object({ message: z.string().trim().min(1).max(4000), context: z.string().max(4000).optional() });

export const askCacadorWithMcpFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => AskSchema.parse(input))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store');
    if (!await verifyCacadorSession(getRequest().headers)) throw new Error('Inicia sessão no Caçador.');
    return askCacadorWithMcp(data.message, data.context);
  });


/** Endpoint exclusivo da inbox WhatsApp; não altera o cérebro global da aplicação. */
export const askCacadorWhatsAppWithMcpFn = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => AskSchema.parse(input))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store');
    if (!await verifyCacadorSession(getRequest().headers)) throw new Error('Inicia sessão no Caçador.');
    return askCacadorWhatsAppWithMcp(data.message, data.context);
  });
