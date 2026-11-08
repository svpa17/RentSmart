// RĂSCRUCE AI — GET /api/health (funcție serverless Vercel): verifică cheia și modelul configurat.
import { createHealthHandler } from './_lib/handlers.js';

let handler;
const get = () => (handler ??= createHealthHandler());

export const OPTIONS = (request) => get().OPTIONS(request);
export const GET = (request) => get().GET(request);
