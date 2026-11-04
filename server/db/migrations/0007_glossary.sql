CREATE TABLE `glossary_terms` (
	`id` text PRIMARY KEY NOT NULL,
	`term` text NOT NULL,
	`locale` text,
	`translation` text,
	`do_not_translate` integer DEFAULT false NOT NULL,
	`case_sensitive` integer DEFAULT false NOT NULL,
	`note` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_by` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "glossary_terms_kind_check" CHECK(("glossary_terms"."do_not_translate" = 1 AND "glossary_terms"."translation" IS NULL) OR ("glossary_terms"."do_not_translate" = 0 AND "glossary_terms"."translation" IS NOT NULL)),
	CONSTRAINT "glossary_terms_locale_check" CHECK("glossary_terms"."locale" IS NULL OR "glossary_terms"."locale" <> 'pt-BR')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `glossary_terms_term_locale_unique` ON `glossary_terms` (lower("term" || '|' || CASE WHEN "locale" IS NULL THEN '*' ELSE "locale" END));