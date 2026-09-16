alter table schools
  alter column has_boarding drop not null,
  alter column has_boarding drop default;

alter table open_days
  alter column registration_required drop not null,
  alter column registration_required drop default;
