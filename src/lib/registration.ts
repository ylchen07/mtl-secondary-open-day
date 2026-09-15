import type { AgendaEvent } from './types';

export type RegistrationAction =
  | { kind: 'register'; href: string }
  | { kind: 'check'; href: string }
  | null;

export function registrationAction(
  event: Pick<AgendaEvent, 'registration_required' | 'registration_url' | 'source_url'>,
  past: boolean,
): RegistrationAction {
  if (past) {
    return null;
  }

  if (event.registration_required === true) {
    return event.registration_url ? { kind: 'register', href: event.registration_url } : null;
  }

  if (event.registration_required === null) {
    return { kind: 'check', href: event.source_url };
  }

  return null;
}
