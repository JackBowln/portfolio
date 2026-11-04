CREATE TABLE `translation_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`target_locale` text NOT NULL,
	`source_revision_id` text,
	`source_hash` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`status` text DEFAULT 'estimated' NOT NULL,
	`segments_total` integer NOT NULL,
	`segments_done` integer DEFAULT 0 NOT NULL,
	`estimated_input_tokens` integer NOT NULL,
	`estimated_output_tokens` integer NOT NULL,
	`estimated_neurons` integer NOT NULL,
	`estimated_cost_micro_usd` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`neurons` integer DEFAULT 0 NOT NULL,
	`cost_micro_usd` integer DEFAULT 0 NOT NULL,
	`usage_estimated` integer DEFAULT false NOT NULL,
	`results` text DEFAULT '{"done":{},"failed":[]}' NOT NULL,
	`error` text,
	`requested_by` text,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `translation_jobs_created_at_idx` ON `translation_jobs` (`created_at`);--> statement-breakpoint
CREATE INDEX `translation_jobs_entity_idx` ON `translation_jobs` (`entity_type`,`entity_id`,`target_locale`);