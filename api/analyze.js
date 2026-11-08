// RĂSCRUCE AI — POST /api/analyze (funcție serverless Vercel, semnătura Web Request/Response).
import { createAnalyzeHandler } from './_lib/handlers.js';

let handler;
const get = () => (handler ??= createAnalyzeHandler());

export const OPTIONS = (request) => get().OPTIONS(request);
export const POST = (request) => get().POST(request);
