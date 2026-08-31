import type { SchoolFile } from './schema';
import type { OpenDayRow, SchoolRow } from './types';

export function toSchoolRow(file: SchoolFile): Omit<SchoolRow, 'id'> {
  const { location, open_days: _events, ...rest } = file;
  return {
    ...rest,
    tuition_annual_cad: file.tuition_annual_cad ?? null,
    lat: location?.lat ?? null,
    lng: location?.lng ?? null,
  };
}

export function toOpenDayRows(
  file: SchoolFile,
  schoolId: string,
): Omit<OpenDayRow, 'id'>[] {
  return file.open_days.map((event) => ({
    school_id: schoolId,
    starts_at: new Date(event.starts_at).toISOString(),
    ends_at: new Date(event.ends_at).toISOString(),
    type: event.type,
    academic_year: event.academic_year,
    registration_required: event.registration_required,
    registration_url: event.registration_url ?? null,
    notes_en: event.notes_en ?? null,
    notes_fr: event.notes_fr ?? null,
    source_url: event.source_url,
    last_verified_at: event.last_verified_at,
    status: event.status,
  }));
}
