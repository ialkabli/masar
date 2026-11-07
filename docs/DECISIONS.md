# Engineering decisions

- React + TypeScript client; Fastify API; no client-side source of truth for business records.
- PGlite runs the PostgreSQL engine locally, persists on disk, and needs no server installation. Set DATABASE_URL for an external PostgreSQL server. Both use parameterized SQL and complete transactions.
- The embedded database serializes complete transactions, so its writes cannot interleave. External PostgreSQL uses pooled connections and permits concurrent transactions. Domain-specific database locks/constraints cover external PostgreSQL access as documented in README.
- Passwords use salted scrypt; only SHA-256 session token hashes are stored. Bearer credentials stay in React memory, never localStorage. Refreshing the browser requires login again. Tokens expire after 12 hours; logout revokes them.
- No permissive CORS. The API validates browser origins, limits request sizes and login frequency. No payment data, email delivery, or third-party account integrations.
- Local demonstration product, not a production security certification. Horizontal scaling, password recovery, MFA, audit export and managed backups need additional work.
