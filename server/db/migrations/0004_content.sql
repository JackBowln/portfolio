CREATE TABLE `tag_localizations` (
	`tag_id` text NOT NULL,
	`locale` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`translation_state` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`tag_id`, `locale`),
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_localizations_locale_slug_unique` ON `tag_localizations` (`locale`,`slug`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`url` text,
	`icon_key` text,
	`created_by` text,
	`updated_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "tags_url_check" CHECK("tags"."url" IS NULL OR "tags"."url" LIKE 'https://%')
);
--> statement-breakpoint
CREATE TABLE `article_localizations` (
	`id` text PRIMARY KEY NOT NULL,
	`locale` text NOT NULL,
	`seo_title` text,
	`seo_description` text,
	`og_image_media_id` text,
	`noindex` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_at` integer,
	`published_revision_id` text,
	`published_snapshot` text,
	`published_at` integer,
	`translation_state` text NOT NULL,
	`source_revision_id` text,
	`segments_meta` text NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`working_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text,
	`deleted_at` integer,
	`article_id` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`body` text NOT NULL,
	`word_count` integer DEFAULT 0 NOT NULL,
	`reading_time_min` integer DEFAULT 0 NOT NULL,
	`toc` text NOT NULL,
	`published_slug` text,
	`published_title` text,
	`published_cover_media_id` text,
	`published_reading_time_min` integer,
	`excerpt` text DEFAULT '' NOT NULL,
	`published_excerpt` text,
	FOREIGN KEY (`og_image_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`published_revision_id`) REFERENCES `article_revisions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_revision_id`) REFERENCES `article_revisions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`published_cover_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "article_localizations_scheduled_check" CHECK("article_localizations"."status" <> 'scheduled' OR "article_localizations"."scheduled_at" IS NOT NULL),
	CONSTRAINT "article_localizations_source_check" CHECK(("article_localizations"."locale" = 'pt-BR') = ("article_localizations"."translation_state" = 'source')),
	CONSTRAINT "article_localizations_published_check" CHECK(("article_localizations"."published_revision_id" IS NULL) = ("article_localizations"."published_snapshot" IS NULL)),
	CONSTRAINT "article_localizations_published_slug_check" CHECK(("article_localizations"."published_revision_id" IS NULL) = ("article_localizations"."published_slug" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_localizations_article_locale_unique` ON `article_localizations` (`article_id`,`locale`);--> statement-breakpoint
CREATE INDEX `article_localizations_published_idx` ON `article_localizations` (`locale`,"published_at" DESC,"id" DESC) WHERE "article_localizations"."published_revision_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `article_localizations_status_scheduled_idx` ON `article_localizations` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `article_localizations_locale_slug_unique` ON `article_localizations` (`locale`,`slug`) WHERE "article_localizations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `article_localizations_locale_published_slug_unique` ON `article_localizations` (`locale`,`published_slug`) WHERE "article_localizations"."published_slug" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `article_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`localization_id` text NOT NULL,
	`locale` text NOT NULL,
	`number` integer NOT NULL,
	`kind` text NOT NULL,
	`snapshot_gz` blob NOT NULL,
	`content_hash` text NOT NULL,
	`note` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`article_id` text NOT NULL,
	FOREIGN KEY (`localization_id`) REFERENCES `article_localizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_revisions_localization_number_unique` ON `article_revisions` (`localization_id`,`number`);--> statement-breakpoint
CREATE INDEX `article_revisions_localization_created_idx` ON `article_revisions` (`localization_id`,"created_at" DESC);--> statement-breakpoint
CREATE TABLE `article_tags` (
	`article_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`article_id`, `tag_id`),
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`cover_media_id` text,
	`draft_tag_ids` text NOT NULL,
	`first_published_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`created_by` text,
	`updated_by` text,
	`deleted_at` integer,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cover_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `page_localizations` (
	`id` text PRIMARY KEY NOT NULL,
	`locale` text NOT NULL,
	`seo_title` text,
	`seo_description` text,
	`og_image_media_id` text,
	`noindex` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_at` integer,
	`published_revision_id` text,
	`published_snapshot` text,
	`published_at` integer,
	`translation_state` text NOT NULL,
	`source_revision_id` text,
	`segments_meta` text NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`working_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text,
	`deleted_at` integer,
	`page_id` text NOT NULL,
	`blocks` text NOT NULL,
	FOREIGN KEY (`og_image_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`published_revision_id`) REFERENCES `page_revisions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_revision_id`) REFERENCES `page_revisions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "page_localizations_scheduled_check" CHECK("page_localizations"."status" <> 'scheduled' OR "page_localizations"."scheduled_at" IS NOT NULL),
	CONSTRAINT "page_localizations_source_check" CHECK(("page_localizations"."locale" = 'pt-BR') = ("page_localizations"."translation_state" = 'source')),
	CONSTRAINT "page_localizations_published_check" CHECK(("page_localizations"."published_revision_id" IS NULL) = ("page_localizations"."published_snapshot" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `page_localizations_page_locale_unique` ON `page_localizations` (`page_id`,`locale`);--> statement-breakpoint
CREATE INDEX `page_localizations_published_idx` ON `page_localizations` (`locale`,"published_at" DESC,"id" DESC) WHERE "page_localizations"."published_revision_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `page_localizations_status_scheduled_idx` ON `page_localizations` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `page_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`localization_id` text NOT NULL,
	`locale` text NOT NULL,
	`number` integer NOT NULL,
	`kind` text NOT NULL,
	`snapshot_gz` blob NOT NULL,
	`content_hash` text NOT NULL,
	`note` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`page_id` text NOT NULL,
	FOREIGN KEY (`localization_id`) REFERENCES `page_localizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `page_revisions_localization_number_unique` ON `page_revisions` (`localization_id`,`number`);--> statement-breakpoint
CREATE INDEX `page_revisions_localization_created_idx` ON `page_revisions` (`localization_id`,"created_at" DESC);--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_key_unique` ON `pages` (`key`);--> statement-breakpoint
CREATE TABLE `project_localizations` (
	`id` text PRIMARY KEY NOT NULL,
	`locale` text NOT NULL,
	`seo_title` text,
	`seo_description` text,
	`og_image_media_id` text,
	`noindex` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_at` integer,
	`published_revision_id` text,
	`published_snapshot` text,
	`published_at` integer,
	`translation_state` text NOT NULL,
	`source_revision_id` text,
	`segments_meta` text NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`working_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text,
	`deleted_at` integer,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`body` text NOT NULL,
	`word_count` integer DEFAULT 0 NOT NULL,
	`reading_time_min` integer DEFAULT 0 NOT NULL,
	`toc` text NOT NULL,
	`published_slug` text,
	`published_title` text,
	`published_cover_media_id` text,
	`published_reading_time_min` integer,
	`summary` text DEFAULT '' NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`highlights` text NOT NULL,
	`published_summary` text,
	FOREIGN KEY (`og_image_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`published_revision_id`) REFERENCES `project_revisions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_revision_id`) REFERENCES `project_revisions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`published_cover_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "project_localizations_scheduled_check" CHECK("project_localizations"."status" <> 'scheduled' OR "project_localizations"."scheduled_at" IS NOT NULL),
	CONSTRAINT "project_localizations_source_check" CHECK(("project_localizations"."locale" = 'pt-BR') = ("project_localizations"."translation_state" = 'source')),
	CONSTRAINT "project_localizations_published_check" CHECK(("project_localizations"."published_revision_id" IS NULL) = ("project_localizations"."published_snapshot" IS NULL)),
	CONSTRAINT "project_localizations_published_slug_check" CHECK(("project_localizations"."published_revision_id" IS NULL) = ("project_localizations"."published_slug" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_localizations_project_locale_unique` ON `project_localizations` (`project_id`,`locale`);--> statement-breakpoint
CREATE INDEX `project_localizations_published_idx` ON `project_localizations` (`locale`,"published_at" DESC,"id" DESC) WHERE "project_localizations"."published_revision_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `project_localizations_status_scheduled_idx` ON `project_localizations` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_localizations_locale_slug_unique` ON `project_localizations` (`locale`,`slug`) WHERE "project_localizations"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `project_localizations_locale_published_slug_unique` ON `project_localizations` (`locale`,`published_slug`) WHERE "project_localizations"."published_slug" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `project_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`localization_id` text NOT NULL,
	`locale` text NOT NULL,
	`number` integer NOT NULL,
	`kind` text NOT NULL,
	`snapshot_gz` blob NOT NULL,
	`content_hash` text NOT NULL,
	`note` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`project_id` text NOT NULL,
	FOREIGN KEY (`localization_id`) REFERENCES `project_localizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_revisions_localization_number_unique` ON `project_revisions` (`localization_id`,`number`);--> statement-breakpoint
CREATE INDEX `project_revisions_localization_created_idx` ON `project_revisions` (`localization_id`,"created_at" DESC);--> statement-breakpoint
CREATE TABLE `project_technologies` (
	`project_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`project_id`, `tag_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`cover_media_id` text,
	`gallery_media_ids` text NOT NULL,
	`draft_technology_ids` text NOT NULL,
	`period_start` text,
	`period_end` text,
	`repo_url` text,
	`demo_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`created_by` text,
	`updated_by` text,
	`deleted_at` integer,
	FOREIGN KEY (`cover_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "projects_period_start_check" CHECK("projects"."period_start" IS NULL OR "projects"."period_start" GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]'),
	CONSTRAINT "projects_period_end_check" CHECK("projects"."period_end" IS NULL OR "projects"."period_end" GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]'),
	CONSTRAINT "projects_repo_url_check" CHECK("projects"."repo_url" IS NULL OR "projects"."repo_url" LIKE 'https://%'),
	CONSTRAINT "projects_demo_url_check" CHECK("projects"."demo_url" IS NULL OR "projects"."demo_url" LIKE 'https://%')
);
--> statement-breakpoint
CREATE INDEX `projects_sort_order_idx` ON `projects` (`sort_order`);