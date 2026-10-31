ALTER TABLE `site_setting_localizations` ADD `segments_meta` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `media_localizations` ADD `segments_meta` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `tag_localizations` ADD `segments_meta` text DEFAULT '{}' NOT NULL;