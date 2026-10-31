CREATE TABLE `contact_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`message` text NOT NULL,
	`locale` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`ip_hash` text,
	`created_at` integer NOT NULL,
	`read_at` integer
);
--> statement-breakpoint
CREATE INDEX `contact_messages_status_idx` ON `contact_messages` (`status`,`id`);--> statement-breakpoint
CREATE INDEX `contact_messages_created_at_idx` ON `contact_messages` (`created_at`);