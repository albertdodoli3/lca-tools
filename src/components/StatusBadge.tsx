import type { ContractStatus } from '@prisma/client';
import { STATUS_LABEL, STATUS_STYLE } from '@/lib/status';

export function StatusBadge({ status }: { status: ContractStatus }) {
  return <span className={`badge ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}
