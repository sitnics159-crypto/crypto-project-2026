CREATE TABLE blockscout_request_window (
  name TEXT PRIMARY KEY NOT NULL,
  oldest_ms INTEGER,
  second_ms INTEGER,
  third_ms INTEGER,
  fourth_ms INTEGER,
  newest_ms INTEGER NOT NULL
);
