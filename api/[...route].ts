import type { Request, Response } from 'express';

let cachedApp: ((req: Request, res: Response) => unknown) | null = null;
let loadError: Error | null = null;

export default async function handler(req: Request, res: Response) {
  if (!cachedApp && !loadError) {
    try {
      const mod = await import('../src/server/app.ts');
      cachedApp = mod.createApiApp();
    } catch (err) {
      loadError = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to initialize serverless API:', loadError);
    }
  }

  if (loadError || !cachedApp) {
    res.setHeader('X-Storage-Ephemeral', '1');
    res.status(503).json({
      error: 'API serverless em modo de contingência local.',
      ephemeral: true,
    });
    return;
  }

  return cachedApp(req, res);
}
