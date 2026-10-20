import { requireAdmin } from '@/lib/auth';
import { getSettings, appUrl } from '@/lib/settings';
import { SettingsForm } from './SettingsForm';

export default async function SettingsPage() {
  await requireAdmin();
  const s = await getSettings();
  const { smtpPassEnc, ghlTokenEnc, brevoApiKeyEnc, ...rest } = s;
  return <SettingsForm s={{ ...rest, hasSmtpPass: !!smtpPassEnc, hasGhlToken: !!ghlTokenEnc, hasBrevoKey: !!brevoApiKeyEnc, updatedAt: s.updatedAt.toISOString() }} appUrl={appUrl()} />;
}
