-- A school now has either a real bilingual description or none at all.
-- The inline length(trim(...)) > 0 CHECK constraints are deliberately kept: a
-- CHECK that evaluates to NULL passes in Postgres, so they go quiet for NULL
-- rows while still rejecting '' and '   '. An empty-string description is a bug.
alter table schools alter column description_en drop not null;
alter table schools alter column description_fr drop not null;
