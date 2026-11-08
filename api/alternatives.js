// RentSmart — POST /api/alternatives (funcție serverless Vercel, semnătura Web Request/Response).
import { createAlternativesHandler } from './_lib/handlers.js';

let handler;
const get = () => (handler ??= createAlternativesHandler());

export const OPTIONS = (request) => get().OPTIONS(request);
export const POST = (request) => get().POST(request);
