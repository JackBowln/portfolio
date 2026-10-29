CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`mime_type` text NOT NULL,
	`original_filename` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`width` integer,
	`height` integer,
	`duration_ms` integer,
	`sha256` text NOT NULL,
	`original_key` text NOT NULL,
	`variants` text NOT NULL,
	`placeholder_data_url` text,
	`dominant_color` text,
	`focal_x` real DEFAULT 0.5 NOT NULL,
	`focal_y` real DEFAULT 0.5 NOT NULL,
	`decorative` integer DEFAULT false NOT NULL,
	`poster_media_id` text,
	`created_by` text,
	`updated_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`poster_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "media_focal_check" CHECK("media"."focal_x" BETWEEN 0 AND 1 AND "media"."focal_y" BETWEEN 0 AND 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_sha256_unique` ON `media` (`sha256`);--> statement-breakpoint
CREATE INDEX `media_status_created_idx` ON `media` (`status`,"created_at" DESC);--> statement-breakpoint
CREATE TABLE `media_localizations` (
	`media_id` text NOT NULL,
	`locale` text NOT NULL,
	`alt` text DEFAULT '' NOT NULL,
	`caption` text,
	`credit` text,
	`translation_state` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`media_id`, `locale`),
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `media_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`media_id` text NOT NULL,
	`locale` text NOT NULL,
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`size` integer NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_tracks_media_locale_kind_unique` ON `media_tracks` (`media_id`,`locale`,`kind`);--> statement-breakpoint
CREATE TABLE `media_usages` (
	`media_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`locale` text,
	`context` text NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `media_usages_media_idx` ON `media_usages` (`media_id`);--> statement-breakpoint
CREATE INDEX `media_usages_entity_idx` ON `media_usages` (`entity_type`,`entity_id`);