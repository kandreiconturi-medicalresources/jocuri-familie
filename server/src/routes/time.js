// POST /api/time/heartbeat {game}
import { onlyKeys, BadRequest } from '../auth.js';

export const GAME_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

export default function timeRoutes(ctx) {
  const { time, rooms } = ctx;

  function heartbeat({ body, auth }) {
    onlyKeys(body, ['game']);
    if (typeof body.game !== 'string' || !GAME_RE.test(body.game)) throw new BadRequest('game');
    const t = time.heartbeat(auth.user);
    if (!t.allowedNow) rooms.kickUser(auth.user.id, 'time');
    return [200, { time: t }];
  }

  return [{ method: 'POST', path: /^\/api\/time\/heartbeat$/, auth: 'user', handler: heartbeat }];
}
