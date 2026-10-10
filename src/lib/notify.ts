import 'server-only';
import { db } from './db';
import { getSettings, appUrl } from './settings';
import { sendMail } from './mail';

/** Notifica in app al proprietario del contratto e agli admin; email agli indirizzi di notifica. */
export async function notifyTeam(contract: { id: string; ownerId: string; code: string }, message: string, opts: { email?: boolean } = {}) {
  const admins = await db.user.findMany({ where: { role: 'ADMIN', active: true }, select: { id: true } });
  const ids = [...new Set([contract.ownerId, ...admins.map((a) => a.id)])];
  await db.notification.createMany({ data: ids.map((userId) => ({ userId, contractId: contract.id, message })) });
  if (opts.email) {
    const s = await getSettings();
    const owner = await db.user.findUnique({ where: { id: contract.ownerId }, select: { email: true } });
    const to = [...new Set([...s.notifyEmails.split(/[,;\s]+/).filter(Boolean), owner?.email].filter(Boolean))] as string[];
    for (const addr of to) {
      await sendMail({ to: addr, subject: `[${contract.code}] ${message}`, text: message, kind: 'notifica_team', contractId: contract.id, button: { label: 'Apri il contratto', url: `${appUrl()}/contratti/${contract.id}` } });
    }
  }
}
