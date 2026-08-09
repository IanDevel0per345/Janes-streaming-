CREATE TABLE IF NOT EXISTS `MovieSource` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `movieId` text NOT NULL,
  `url` text NOT NULL,
  `type` text DEFAULT 'embed' NOT NULL,
  `quality` text,
  `language` text,
  `title` text,
  `provider` text NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `addedAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `lastCheckedAt` text
);
CREATE INDEX IF NOT EXISTS `MovieSource_movieId_idx` ON `MovieSource` (`movieId`);
CREATE INDEX IF NOT EXISTS `MovieSource_provider_idx` ON `MovieSource` (`provider`);
CREATE INDEX IF NOT EXISTS `MovieSource_status_idx` ON `MovieSource` (`status`);
CREATE UNIQUE INDEX IF NOT EXISTS `MovieSource_movieId_url_key` ON `MovieSource` (`movieId`,`url`);
