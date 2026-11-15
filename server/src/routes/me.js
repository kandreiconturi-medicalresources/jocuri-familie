// GET /api/me
import { publicUser } from '../auth.js';

export default function meRoutes(ctx) {
  const { time } = ctx;
  return [
    {
      method: 'GET', path: /^\/api\/me$/, auth: 'user',
      handler: ({ auth }) => [200, { user: publicUser(auth.user), time: time.status(auth.user) }],
    },
  ];
}
