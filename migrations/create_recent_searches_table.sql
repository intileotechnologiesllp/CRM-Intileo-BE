-- Migration to create RecentSearches table
CREATE TABLE IF NOT EXISTS `RecentSearches` (
  `id` int NOT NULL AUTO_INCREMENT,
  `searchTerm` varchar(255) NOT NULL COMMENT 'The search term entered by the user',
  `searchTypes` json DEFAULT NULL COMMENT 'Array of entity types searched (deals, people, etc.)',
  `resultsCount` int DEFAULT '0' COMMENT 'Number of results returned for this search',
  `masterUserID` int NOT NULL COMMENT 'ID of the user who performed the search',
  `searchedAt` datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'When the search was performed',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_recent_searches_user_date` (`masterUserID`, `searchedAt`),
  KEY `idx_recent_searches_term_user` (`searchTerm`, `masterUserID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
