# API reference

All endpoints use `/api` prefix. JSON body requests need `Content-Type: application/json`. Protected endpoints require `Authorization: Bearer <token>`.

| Method | Route | Contract |
| --- | --- | --- |
| GET | /health | Public `{ok:true}` |
| POST | /login | Public `{email,password}` → `{token,user}`; 10 requests/minute per source IP |
| GET | /me | Current user |
| POST | /logout | Revoke current token |
| GET | /workspaces | Membership-scoped workspaces |
| POST | /workspaces | `{name}`; creator becomes owner |
| GET | /workspaces/:id | Members, tasks, latest 50 activity events |
| POST | /workspaces/:id/members | Owner: `{email}` of an existing account |
| POST | /workspaces/:id/tasks | `{title,priority,assignee}`; member self-assignment only |
| PATCH | /tasks/:id | `{status,version}`; owner or assignee; stale version returns 409 |
| GET/POST | /tasks/:id/comments | Member access; POST `{body}` |
| GET | /notifications | Latest 30 personal in-app notifications |
| POST | /notifications/read | Mark own notifications read |

## Errors and limits

Errors use `{error: string}`. HTTP 400: invalid input; 401: missing/expired session; 403: forbidden role, owner mismatch or browser origin; 404: unavailable/missing resource; 409: state/uniqueness/concurrency conflict; 413: request too large; 429: rate limit; 500: generic server fault. Successful mutations currently return HTTP 200.

JSON request limit is 1 MB. This application does not expose a file-upload endpoint. Global request limit is 120/minute per source IP. The sample browser client keeps credentials in memory. No cross-origin API access is configured. Dates are validated by the server. All SQL values are parameterized.
