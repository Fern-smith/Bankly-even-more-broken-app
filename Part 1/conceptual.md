# JWT & Testing --- Conceptual Exercise 

------------------------------------------------------------------------

## Table of contents

1.  [What is a JWT?](#what-is-a-jwt)
2.  [What is the signature portion of the JWT? What does it
    do?](#what-is-the-signature-portion-of-the-jwt-what-does-it-do)
3.  [If a JWT is intercepted, can an attacker see the
    payload?](#if-a-jwt-is-intercepted-can-an-attacker-see-the-payload)
4.  [How to implement authentication with JWT
    (high-level)](#how-to-implement-authentication-with-jwt-high-level)
5.  [Compare unit, integration, and end-to-end
    tests](#compare-unit-integration-and-end-to-end-tests)
6.  [What is a mock? What to mock?](#what-is-a-mock-what-to-mock)
7.  [What is Continuous Integration
    (CI)?](#what-is-continuous-integration-ci)
8.  [What is an environment variable?](#what-is-an-environment-variable)
9.  [What is TDD? Benefits and
    drawbacks](#what-is-tdd-benefits-and-drawbacks)
10. [Value of JSON Schema for
    validation](#value-of-json-schema-for-validation)
11. [How to decide what code to test](#how-to-decide-what-code-to-test)
12. [What does `RETURNING` do in SQL? When to use
    it?](#what-does-returning-do-in-sql-when-to-use-it)
13. [Differences between WebSockets and
    HTTP](#differences-between-websockets-and-http)
14. [Flask vs Express --- how to think about the
    choice](#flask-vs-express--how-to-think-about-the-choice)

------------------------------------------------------------------------

## What is a JWT?

**Answer:**

A **JWT (JSON Web Token)** is a compact, URL-safe token format for
securely transmitting claims between parties. A JWT is typically used
for **authentication and authorization** and is composed of three parts
separated by dots:

    header.payload.signature

-   **Header** --- metadata describing the token, usually includes `alg`
    (signing algorithm) and `typ` (token type). Example:

``` json
{ "alg": "HS256", "typ": "JWT" }
```

-   **Payload** --- a set of claims (registered claims like `iss`,
    `sub`, `aud`, `exp`, `iat`, and any custom claims). These are the
    statements about an entity (usually the user) and additional data.

-   **Signature** --- cryptographic proof that the token was issued by a
    party holding the signing key and that the token hasn't been
    tampered with.

JWTs enable stateless authentication because the server can validate the
token and read the claims without storing session state.

## What is the signature portion of the JWT? What does it do?

**Answer:**

The **signature** is the third part of a JWT and provides **integrity**
and **authenticity**:

-   How it's created (typical HS256 example):
    1.  Compute `base64url(header)` and `base64url(payload)`.
    2.  Create the signing input:
        `base64url(header) + "." + base64url(payload)`.
    3.  Apply the signing function:
        e.g. `HMAC-SHA256(secret, signing_input)`.
    4.  `signature = base64url(result)` and append it to the token.
-   What it does:
    -   Ensures the token hasn't been modified (integrity). If an
        attacker changes the payload, the signature will no longer
        match.
    -   Proves the token was issued by a holder of the signing key
        (authenticity). With asymmetric algorithms (e.g., RS256), tokens
        are signed with a **private key** and verified with the
        corresponding **public key**.

Note: JWTs can be **signed (JWS)** or **encrypted (JWE)**. A signed JWT
proves origin and integrity but does not encrypt the payload by default.

## If a JWT is intercepted, can an attacker see what's inside the payload?

**Answer:**

Yes --- an attacker can **read** the payload if they intercept a JWT.
The header and payload are encoded with **base64url**, not encrypted, so
anyone can decode them and view the contents. That means:

-   Do **not** store secrets (passwords, full credit card numbers,
    private data) in the JWT payload
-   Use **HTTPS/TLS** to protect tokens in transit
-   If confidentiality is required, use **JWE (encrypted JWT)** or
    encrypt the sensitive fields separately

## How can you implement authentication with a JWT? Describe how it works at a high level.

**Answer:**

**High-level flow:**

1.  Client sends credentials (username/password) to the authentication
    endpoint (over HTTPS).
2.  Server validates credentials.
3.  Server issues an **access token (JWT)** with claims (user id, roles,
    `exp` expiration, etc.). Optionally the server also issues a
    **refresh token**.
4.  Server returns tokens to the client.
5.  Client stores the access token and includes it in subsequent
    requests, typically in the `Authorization: Bearer <token>` header.
6.  Server verifies the token signature and checks claims (expiration,
    audience, issuer). If valid, server processes request using the
    claims.
7.  When the access token expires, the client can obtain a new access
    token using the refresh token (if using refresh tokens).

**Storage & security notes:** - **Prefer** `HttpOnly` + `Secure` cookies
for tokens to mitigate XSS (but protect against CSRF with same-site
cookies or CSRF tokens). - Storing tokens in `localStorage` is simple
but vulnerable to XSS attacks. - Keep access tokens short-lived and keep
refresh tokens long-lived and better protected. - Support token
revocation/rotation (e.g., rotate refresh tokens, store a server-side
revocation list or use short access tokens with revocation via key
rotation).

**Stateless vs stateful tradeoffs:** - JWTs enable stateless
authentication (no server-side session store). But server-side measures
are still needed for token revocation and logout semantics.

## Compare unit, integration and end-to-end tests

**Unit tests** - Test individual functions or components in isolation. -
Fast, deterministic, and numerous. - Use mocks/stubs to replace external
dependencies. - Example: test that `calculateDiscount()` returns the
correct value for certain inputs.

**Integration tests** - Test how multiple components work together
(module-to-module or service-to-database). - Slower than unit tests, may
use real DB or test containers. - Example: test that API endpoint writes
a record to the real test database and returns expected status.

**End-to-end (E2E) tests** - Test complete user flows from the user's
perspective, including UI and backend. - Slowest and most brittle but
closest to real-world behavior. - Example: simulate a user logging in,
creating a resource, and verifying the UI shows it.

**Testing pyramid recommendation**: many unit tests → fewer integration
tests → few E2E tests.

## What is a mock? What are some things you would mock?

**Answer:**

A **mock** is a test double that simulates the behavior of a real
dependency and lets you set expectations and verify interactions during
tests. Mocks are used to:

-   Isolate the unit under test
-   Control external inputs and outputs
-   Avoid slow or flaky components (network, DB)

**Things commonly mocked:** - Database calls / repositories - HTTP calls
to external services / third-party APIs - Email or SMS sending
services - Payment gateways - File system operations -
Authentication/authorization services - Time (e.g., freeze the clock)
and randomness

**Related test doubles:** stubs (preset responses), spies (record
calls), fakes (in-memory lightweight implementations).

## What is continuous integration (CI)?

**Answer:**

Continuous Integration is the practice of integrating code changes
frequently to a shared repository and automatically running a suite of
checks (build, lint, tests) on each change. A typical CI pipeline
includes:

-   Static analysis / linting
-   Running unit and integration tests
-   Building artifacts
-   (Optional) Deploying to staging or running E2E tests

CI helps catch integration problems early, keeps the main branch
healthy, and speeds up feedback to developers.

## What is an environment variable and what are they used for?

**Answer:**

**Environment variables** are key-value pairs provided to processes
outside of source code. They configure application behavior per
environment.

**Common uses:** - Database connection strings - API keys and secrets -
Application mode (development/staging/production) - Ports and
hostnames - Feature flags

**Best practices:** - Do not commit secrets to version control - Use
secret managers (AWS Secrets Manager, Vault) for production - Provide
sensible defaults and validate required variables on startup

## What is TDD? What are some benefits and drawbacks?

**TDD (Test-Driven Development)**

-   Workflow: **Red → Green → Refactor**
    1.  Write a failing test (Red)
    2.  Write just enough code to pass the test (Green)
    3.  Refactor the code, keeping tests green

**Benefits:** - Leads to better design and smaller, testable units -
High test coverage and fewer regressions - Tests act as documentation

**Drawbacks:** - Slower to start feature development - Learning curve
and discipline required - Potential to over-focus on tests for trivial
code - Tests can become brittle if implementation details are tested
instead of behavior

## What is the value of using JSON Schema for validation?

**Answer:**

JSON Schema provides a standardized, machine-readable way to declare the
structure and constraints of JSON data. Benefits include:

-   **Standardized validation** across services
-   **Self-documenting** API contracts
-   **Type and format checks** (number, string, pattern, enum)
-   **Reusable schemas** and composition (`$ref`)
-   **Tooling & code generation** support in many languages
-   **Clear error reporting** for invalid payloads

**Example (simple schema):**

``` json
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "age": { "type": "integer", "minimum": 0 }
  },
  "required": ["name"]
}
```

## What are some ways to decide which code to test?

**Prioritize testing for:** - Business-critical logic - Complex
algorithms and branching - Edge cases and error handling - Public APIs
and library interfaces - Areas with historical bugs or instability -
Integration points with external systems

**De-prioritize testing for:** - Trivial getters/setters -
Auto-generated or framework boilerplate - Third-party library internals

Use risk and value to decide how much testing to apply to each area.

## What does `RETURNING` do in SQL? When would you use it?

**Answer:**

`RETURNING` is a SQL clause (supported by PostgreSQL and some other DBs)
that returns columns from rows affected by `INSERT`, `UPDATE`, or
`DELETE` in the same statement. It avoids a separate `SELECT` after the
mutation.

**Use cases:** - Get auto-generated IDs after an `INSERT`. - Return
updated values (timestamps, computed fields) after an `UPDATE`. -
Confirm which rows were deleted by a `DELETE`.

**Example:**

``` sql
INSERT INTO users (name, email)
VALUES ('John', 'john@example.com')
RETURNING id, created_at;
```

## What are some differences between WebSockets and HTTP?

**HTTP** - Request--response protocol (client initiates) - Stateless
(each request is independent) - Higher overhead per message (headers,
new TCP/TLS handshake depending on connection) - Good for APIs, restful
resources, and cached responses

**WebSockets** - Persistent, bidirectional connection over a single
TCP/TLS connection - Either server or client can send messages after the
handshake - Lower per-message overhead once connection is open - Good
for real-time features (chat, live updates, multiplayer games)

**Tradeoffs:** - WebSockets require additional connection management and
scale considerations (e.g., many open sockets) - HTTP is simpler to
scale horizontally with stateless servers behind load balancers

## Did you prefer using Flask over Express? Why or why not?

**Answer:** I don't have personal preferences, but here's how
developers often compare the two:

**Flask (Python)** - Minimal and explicit, great for small to medium
services - Strong Python ecosystem (data tooling, ML) - Clear control
flow and fewer surprises

**Express (Node.js)** - Large middleware ecosystem and many npm
packages - JavaScript/TypeScript across full stack (one language) -
Non-blocking I/O model can be beneficial for I/O-heavy workloads

**Choice depends on:** team skillset, ecosystem, performance needs, and
the nature of the project.
