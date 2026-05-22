# AI Usage Notes

## 1. Tools used

- Claude Sonnet (claude.ai) — primary assistant for bug identification, fixes, and tests
- VS Code — editor for all code changes
- GitHub Desktop — version control and commits

---

## 2. Prompt journal

### Prompt 1

```
I have a fullstack Node.js/Express + React/TypeScript assessment repo. 
Read all the source files and identify every critical logical, security, 
concurrency, and UX bug you can find across both the backend and frontend.
```

The model produced a comprehensive list of bugs grouped by severity covering SQL injection, missing FOR UPDATE, admin auth gaps, XSS, and polling leak. I kept the full bug list as a starting framework. I rejected the initial ordering — Claude wanted to fix frontend issues before backend data integrity issues. I reordered to prioritise money handling and concurrency first.

### Prompt 2

```
The createOrder function checks stock and decrements it in two separate 
steps outside a transaction. Show me the correct fix using the 
withTransaction helper that already exists in the file.
```

The model produced a rewrite of createOrder that wrapped everything in withTransaction and used getProductByIdForUpdate to lock rows before checking stock. I kept the full transaction approach and the FOR UPDATE lock pattern. I rejected the model's suggestion to check stock after decrementing and rolling back if negative — that approach allows the decrement to run first which is unsafe and puts unnecessary load on the database.

### Prompt 3

```
The chargeOrder function reads order status without a lock. Two concurrent 
requests can both see PENDING and both charge the card. Fix this using a 
transaction and row lock without losing the idempotency key logic.
```

The model produced a rewrite of chargeOrder using withTransaction and getOrderByIdForUpdate, keeping the Redis idempotency check before the transaction. I kept the overall structure but rejected the placement of the Redis cache write — the model put it inside the transaction before the commit which is unsafe. I moved it outside so it only runs after the DB commit is confirmed.

### Prompt 4

```
Write Jest integration tests for the concurrency fix. Two simultaneous 
POST /orders requests for a product with stock=1 should result in exactly 
one 201 and one 409. Use supertest and a real database connection with 
proper beforeEach and afterAll cleanup.
```

The model produced a working concurrency test using Promise.all with setup and teardown. I kept the test structure and assertions. I rejected the initial afterAll cleanup because it deleted the product before deleting order_items which violated the foreign key constraint. I fixed the deletion order to remove child records first.

### Prompt 5

```
The frontend OrderDetailPage uses setInterval with no clearInterval and no 
cleanup in useEffect. Show me the fix and also stop polling once the order 
reaches a terminal state.
```

The model produced a useEffect with clearInterval cleanup and an early return when status is PAID or FAILED. I kept the full fix including the terminal state check. I rejected the model's suggestion to use recursive setTimeout instead of setInterval — while valid I kept setInterval because the cleanup pattern is clearer for this codebase.

---

## 3. AI got it wrong

When asked to fix the chargeOrder idempotency flow, Claude produced this:

```
return withTransaction(async (client) => {
  // lock order, check status, call gateway...

  if (idempotencyKey) {
    await redis.set(
      `idem:${idempotencyKey}`,
      JSON.stringify(result),
      "EX",
      3600,
    );
  }

  // DB commit happens after this block closes
});
```

This is wrong because the Redis write is inside the transaction meaning it runs before the DB commits. If the process crashes between the Redis write and the DB commit the idempotency cache would return a successful result for a charge that was never actually saved to the database. The customer would be told their payment succeeded but no payment record would exist.

I caught it by manually tracing the execution order and asking what happens if the server crashes between the Redis write and the transaction commit. I fixed it by moving the Redis write outside the transaction so it only runs after the DB commit is confirmed.

---

## 4. Validation strategy

- Ran all backend tests after every fix using `npx jest --verbose`
- Ran the frontend test suite using `npm test`
- Manually tested the running app in the browser after each frontend fix
- Cross-referenced PostgreSQL `FOR UPDATE` documentation to confirm row locking behaviour
- Traced execution order manually for all async flows involving both Redis and PostgreSQL to check for partial failure scenarios
- Confirmed CORS behaviour against the MDN CORS spec for the credentials and wildcard combination

---

## 5. What you did NOT delegate

- **Money calculation:** Personally verified that totalAmount must be calculated server-side from real product prices and never trusted from the client. Did not accept any AI suggestion that used the client-supplied value
- **Transaction commit ordering:** Manually decided that the Redis idempotency write must happen after the DB transaction commits not inside it. This is a subtle ordering decision the model got wrong
- **Webhook signature comparison:** Decided to flag that plain string comparison should be replaced with `crypto.timingSafeEqual` in production. The model did not raise this unprompted
- **Auth token storage:** Personally decided to use `sessionStorage` over `localStorage` for the admin token. The model suggested `localStorage` initially which was rejected
- **Rendering untrusted HTML:** Personally confirmed that `dangerouslySetInnerHTML` must be removed entirely rather than sanitized because the content is plain text and there is no legitimate reason to render it as HTML