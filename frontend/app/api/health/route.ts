// Liveness endpoint for the frontend container health check.
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return Response.json({ok: true, service: 'frontend'});
}
