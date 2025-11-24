// SQL-related constants

// Read-only SQL commands allowed in read-only mode
export const READ_ONLY_COMMANDS = ['SELECT', 'DESCRIBE', 'DESC', 'SHOW', 'EXPLAIN'] as const;

// Error messages
export const ERROR_MESSAGES = {
  READ_ONLY_MODE: 'Cannot execute this query in read-only mode. Only SELECT, DESCRIBE, DESC, SHOW, and EXPLAIN are allowed.',
  NO_CONNECTION: 'No active database connection',
  QUERY_FAILED: 'Query execution failed',
} as const;
