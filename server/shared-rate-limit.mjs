const reserveRequest = `
  INSERT INTO blockscout_request_window
    (name, oldest_ms, second_ms, third_ms, fourth_ms, newest_ms)
  VALUES (?1, NULL, NULL, NULL, NULL, COALESCE(?2, CAST(unixepoch('subsec') * 1000 AS INTEGER)))
  ON CONFLICT(name) DO UPDATE SET
    oldest_ms = second_ms,
    second_ms = third_ms,
    third_ms = fourth_ms,
    fourth_ms = newest_ms,
    newest_ms = MAX(newest_ms, excluded.newest_ms)
  WHERE oldest_ms IS NULL OR oldest_ms <= excluded.newest_ms - 1000
  RETURNING name
`;

export function createSharedRateLimit(database, now = () => null) {
  return async () => Boolean(await database.prepare(reserveRequest)
    .bind('blockscout-sepolia', now()).first());
}
