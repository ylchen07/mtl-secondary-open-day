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
      <div className="border border-dashed border-(--rule-strong) bg-(--paper-sunk) p-8 text-center">
        <p className="text-(--ink-2)">{t('emptyFiltered')}</p>
        <button
          type="button"
          onClick={onClear}
          className="mt-3 text-sm font-medium text-(--ink) underline underline-offset-4"
        >
          {t('clearFilters')}
        </button>
      </div>
    );
  }

  return (
    <div className="border border-dashed border-(--rule-strong) bg-(--paper-sunk) p-8 text-center">
      <h2 className="font-(--font-serif) text-2xl font-medium">{t('emptyTitle')}</h2>
      <p className="mx-auto mt-2 max-w-prose text-sm text-(--ink-2)">
        {t('emptyBody')}
      </p>
    </div>
  );
}
