-- Add rules_guide_text to site_config
alter table site_config
add column if not exists rules_guide_text text;

comment on column site_config.rules_guide_text is 'Content for the Rules/Manners chip';
