'use client';

import { useTranslations } from 'next-intl';

export function EmptyState({
  filtered,
  onClear,
}: {
  filtered: boolean;
  onClear: () => void;
}) {
  const t = useTranslations('agenda');

  if (filtered) {
    return (
      <div className="empty-state">
        <p className="empty-message">{t('emptyFiltered')}</p>
        <button
          type="button"
          onClick={onClear}
          className="button button-secondary"
        >
          {t('clearFilters')}
        </button>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <h2 className="empty-title">{t('emptyTitle')}</h2>
      <p className="empty-message">
        {t('emptyBody')}
      </p>
    </div>
  );
}
