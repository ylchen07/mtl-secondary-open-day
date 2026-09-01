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
      <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center">
        <p className="text-neutral-700">{t('emptyFiltered')}</p>
        <button
          type="button"
          onClick={onClear}
          className="mt-3 text-sm underline"
        >
          {t('clearFilters')}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center">
      <h2 className="font-medium">{t('emptyTitle')}</h2>
      <p className="mx-auto mt-2 max-w-prose text-sm text-neutral-600">
        {t('emptyBody')}
      </p>
    </div>
  );
}
