CREATE TABLE `body_metric` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer NOT NULL,
	`date` text NOT NULL,
	`weight_kg` real NOT NULL,
	`waist_cm` real,
	`hip_cm` real,
	`chest_cm` real,
	`arm_cm` real,
	`thigh_cm` real,
	`body_fat_pct` real,
	`lean_mass_kg` real,
	`fat_mass_kg` real,
	`navy_waist_cm` real,
	`navy_neck_cm` real,
	`logged_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `body_metric_date_unique` ON `body_metric` (`date`);--> statement-breakpoint
CREATE TABLE `coach_entry` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer NOT NULL,
	`date` text NOT NULL,
	`entry_type` text DEFAULT 'daily' NOT NULL,
	`content` text NOT NULL,
	`mood` text NOT NULL,
	`generated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coach_entry_date_unique` ON `coach_entry` (`date`);--> statement-breakpoint
CREATE TABLE `food_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer NOT NULL,
	`date` text NOT NULL,
	`meal` text NOT NULL,
	`name` text NOT NULL,
	`calories` integer NOT NULL,
	`protein_g` real NOT NULL,
	`carbs_g` real NOT NULL,
	`fat_g` real NOT NULL,
	`serving_desc` text,
	`source` text NOT NULL,
	`confidence` text,
	`ai_notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `plan_exercise` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day_id` integer NOT NULL,
	`name` text NOT NULL,
	`sets` integer NOT NULL,
	`reps` integer NOT NULL,
	`rest_seconds` integer NOT NULL,
	`weight_kg` real,
	`tempo` text,
	`progression_note` text,
	`order_index` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`day_id`) REFERENCES `workout_day`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`age` integer NOT NULL,
	`sex` text NOT NULL,
	`height_cm` real NOT NULL,
	`weight_kg` real NOT NULL,
	`units` text DEFAULT 'metric' NOT NULL,
	`goal` text DEFAULT 'recomposition' NOT NULL,
	`activity_level` text DEFAULT 'moderate' NOT NULL,
	`experience_level` text DEFAULT 'intermediate' NOT NULL,
	`equipment` text DEFAULT '[]' NOT NULL,
	`days_per_week` integer DEFAULT 4 NOT NULL,
	`goal_calories` integer NOT NULL,
	`goal_protein_g` real NOT NULL,
	`goal_carbs_g` real NOT NULL,
	`goal_fat_g` real NOT NULL,
	`created_at` text DEFAULT (date('now')) NOT NULL,
	`updated_at` text DEFAULT (date('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `progress_photo` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer NOT NULL,
	`date` text NOT NULL,
	`file_uri` text NOT NULL,
	`angle` text DEFAULT 'front' NOT NULL,
	`notes` text,
	`taken_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `session_set` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`plan_exercise_id` integer,
	`exercise_name` text NOT NULL,
	`set_number` integer NOT NULL,
	`weight_kg` real,
	`reps` integer,
	`rpe` real,
	`is_pr` integer DEFAULT false NOT NULL,
	`notes` text,
	`logged_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_exercise_id`) REFERENCES `plan_exercise`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer NOT NULL,
	`plan_id` integer,
	`day_id` integer,
	`date` text NOT NULL,
	`name` text NOT NULL,
	`duration_seconds` integer,
	`notes` text,
	`started_at` text DEFAULT (datetime('now')) NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `workout_plan`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`day_id`) REFERENCES `workout_day`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `water_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer NOT NULL,
	`date` text NOT NULL,
	`amount_ml` integer NOT NULL,
	`logged_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workout_day` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plan_id` integer NOT NULL,
	`day_name` text NOT NULL,
	`muscle_groups` text NOT NULL,
	`estimated_minutes` integer,
	`order_index` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `workout_plan`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workout_plan` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer NOT NULL,
	`name` text NOT NULL,
	`split_type` text NOT NULL,
	`weeks_total` integer NOT NULL,
	`days_per_week` integer NOT NULL,
	`rationale` text,
	`is_active` integer DEFAULT true NOT NULL,
	`start_date` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profile`(`id`) ON UPDATE no action ON DELETE no action
);
