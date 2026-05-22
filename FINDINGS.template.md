# Findings

## Backend

### Issue: SQL Injection in Product Search
- **Where:** `backend/src/repositories/productsRepository.js` — `listProducts` function, the `WHERE name ILIKE '%${q}%'` clause
- **Why:** The search parameter `q` was interpolated directly into the SQL string using a template literal instead of a parameterized query
- **Impact:** Any user can pass a malicious search string to read, modify, or delete arbitrary database data
- **Fix:** Replaced string interpolation with a `$1` parameterized placeholder and passed the value as a query argument so pg handles escaping automatically
- **Trade-offs:** None. Parameterized queries are strictly safer and equally performant

---

### Issue: `getProductByIdForUpdate` Missing `FOR UPDATE`
- **Where:** `backend/src/repositories/productsRepository.js` — `getProductByIdForUpdate` function
- **Why:** The function name promised a row lock but the query was a plain `SELECT` with no `FOR UPDATE` clause, making it identical to a regular read
- **Impact:** Any code relying on this function for concurrency control had no actual lock, making it completely ineffective
- **Fix:** Added `FOR UPDATE` to the query so the row is locked for the duration of the calling transaction
- **Trade-offs:** Holding row locks increases contention under very high load but is necessary for correctness

---

### Issue: Stock Can Go Negative in `decrementStock`
- **Where:** `backend/src/repositories/productsRepository.js` — `decrementStock` function
- **Why:** The `UPDATE` statement had no guard on the current stock value so it would decrement even if stock was already zero
- **Impact:** Stock could go below zero leading to overselling and bad inventory data
- **Fix:** Added `AND stock >= $2` to the `WHERE` clause and throw a 409 if no row is returned, meaning the decrement was blocked
- **Trade-offs:** None. The schema already has a `CHECK (stock >= 0)` constraint but this gives a cleaner and earlier error

---

### Issue: `createOrder` Race Condition — Overselling
- **Where:** `backend/src/services/ordersService.js` — `createOrder` function
- **Why:** Stock check and decrement were separate operations with no transaction wrapping them. Two concurrent requests could both pass the stock check before either decremented
- **Impact:** Multiple orders could be created for the same stock leaving inventory negative and customers charged for items that cannot be fulfilled
- **Fix:** Wrapped the entire function in `withTransaction` and used `getProductByIdForUpdate` to lock each product row before checking and decrementing stock so concurrent orders are fully serialized
- **Trade-offs:** Locks are held for the duration of the loop. Under very high concurrency this adds latency but correctness must come first

---

### Issue: `chargeOrder` Race Condition — Double Charging
- **Where:** `backend/src/services/ordersService.js` — `chargeOrder` function
- **Why:** Order status was read with a plain `SELECT` so two concurrent charge requests could both see `PENDING` and both call the payment gateway
- **Impact:** A customer could be charged twice for the same order
- **Fix:** Wrapped the entire charge flow in `withTransaction` using `getOrderByIdForUpdate` to lock the order row. Payment creation and status update happen atomically in the same transaction
- **Trade-offs:** The DB lock is held while calling the payment gateway which can take up to 600ms. A production-grade fix would add a `PROCESSING` status to release the lock before calling the gateway

---

### Issue: Webhook Duplicate Processing
- **Where:** `backend/src/services/ordersService.js` — `processPaymentWebhook` function and `backend/src/repositories/paymentsRepository.js` — `createWebhookEvent`
- **Why:** No deduplication check existed. The same webhook firing twice would insert duplicate rows and mark the order as paid multiple times
- **Impact:** Duplicate webhook deliveries from the payment provider would cause duplicate processing and corrupt order state
- **Fix:** Added a `UNIQUE` constraint on `payment_events.provider_event_id` via migration and changed the `INSERT` to `ON CONFLICT DO NOTHING`. If `createWebhookEvent` returns null the event is a duplicate and processing stops immediately
- **Trade-offs:** None. Idempotent webhook handling is standard practice

---

### Issue: Admin Routes Have No Authentication
- **Where:** `backend/src/routes/adminRoutes.js` — all routes
- **Why:** `ADMIN_TOKEN` was defined in env but never verified on the server. The middleware was never applied
- **Impact:** Anyone could create or modify products including setting prices to zero or injecting malicious descriptions
- **Fix:** Created `requireAdmin` middleware that checks the `Authorization: Bearer` header against `ADMIN_TOKEN` and applied it via `router.use` so every route is covered
- **Trade-offs:** A static token works for this assessment but production needs JWT-based auth with expiry and rotation

---

### Issue: `GET /orders` Has No Authentication
- **Where:** `backend/src/routes/ordersRoutes.js` — `GET /` route
- **Why:** The route lived in `ordersRoutes.js` outside the admin router so the admin middleware never covered it
- **Impact:** Anyone could enumerate all customer orders, IDs, and payment amounts
- **Fix:** Added `requireAdmin` middleware directly to the `GET /` route
- **Trade-offs:** None

---

### Issue: Webhook Has No Signature Verification
- **Where:** `backend/src/routes/paymentsRoutes.js` — `POST /webhook` route
- **Why:** `WEBHOOK_SECRET` was defined in env but the route never checked it
- **Impact:** Anyone on the internet could POST to `/payments/webhook` and mark any order as paid for free
- **Fix:** Added a check against the `X-Webhook-Secret` header returning 401 if missing or wrong
- **Trade-offs:** Plain string comparison is used. Production should use `crypto.timingSafeEqual` to prevent timing attacks

---

### Issue: `totalAmount` Trusted from Client
- **Where:** `backend/src/services/ordersService.js` — `createOrder` function
- **Why:** The order total was taken directly from `req.body` instead of being calculated from actual product prices
- **Impact:** A user could send `totalAmount: 0.01` and create an order for any products at a penny
- **Fix:** Calculated the total server-side from `enrichedItems` using real product prices. The client-supplied value is ignored entirely
- **Trade-offs:** None

---

### Issue: CORS Wildcard with Credentials
- **Where:** `backend/src/app.js` — CORS configuration
- **Why:** `origin: "*"` with `credentials: true` is invalid per the CORS spec. Browsers reject credentialed requests to wildcard origins
- **Impact:** Credentialed requests fail in browsers and any origin can interact with the API
- **Fix:** Replaced wildcard with `FRONTEND_ORIGIN` from env
- **Trade-offs:** None

---

## Frontend

### Issue: XSS via `dangerouslySetInnerHTML`
- **Where:** `frontend/src/pages/ProductDetailPage.tsx` — product description rendering
- **Why:** Product descriptions were rendered as raw HTML. A malicious description containing a script tag or event handler would execute in the browser
- **Impact:** Any stored XSS payload in a product description executes for every user who views that product
- **Fix:** Replaced `dangerouslySetInnerHTML` with a plain `<p>` tag so React escapes all content automatically
- **Trade-offs:** If rich text descriptions are needed in future a sanitization library like DOMPurify should be used before rendering HTML

---

### Issue: Polling Interval Never Cleared
- **Where:** `frontend/src/pages/OrderDetailPage.tsx` — `useEffect` polling block
- **Why:** `setInterval` was called with no corresponding `clearInterval` and no cleanup function returned from `useEffect`
- **Impact:** The interval kept firing after the user navigated away causing memory leaks, zombie network requests, and state updates on unmounted components
- **Fix:** Stored the interval ID and returned `() => clearInterval(intervalId)` from `useEffect`. Also stops polling once the order reaches `PAID` or `FAILED`
- **Trade-offs:** None

---

### Issue: Pay Button Allows Double Charge
- **Where:** `frontend/src/pages/OrderDetailPage.tsx` — `pay` function and Pay button
- **Why:** The button was never disabled while a charge was in progress and the `pay` function had no guard against concurrent calls
- **Impact:** Clicking Pay multiple times fired multiple charge requests potentially double charging the customer
- **Fix:** Added `disabled={paying}` to the button, an early return if `paying` is true, and wrapped the charge in `try/catch` with `finally` to always reset state
- **Trade-offs:** None

---

### Issue: Checkout Double Submit and Silent Errors
- **Where:** `frontend/src/pages/CartPage.tsx` — `checkout` function and Checkout button
- **Why:** No loading state existed on the button and errors were not caught
- **Impact:** Clicking Checkout multiple times created duplicate orders. Failed checkouts showed no feedback to the user
- **Fix:** Added `checkingOut` state, disabled the button during the request, and wrapped `createOrder` in `try/catch` with a visible error message
- **Trade-offs:** None

---

### Issue: Admin Page No Auth Guard
- **Where:** `frontend/src/pages/AdminPage.tsx` — component root
- **Why:** The `/admin` route rendered the full dashboard with no login check
- **Impact:** Anyone who navigated to `/admin` could view all orders and edit all products
- **Fix:** Added a token gate that shows a login form before rendering the dashboard. Token stored in `sessionStorage` instead of `localStorage` to reduce XSS exposure
- **Trade-offs:** For production a proper auth flow with server-issued sessions would be more secure

---

### Issue: Optimistic Update Before Server Confirmation
- **Where:** `frontend/src/pages/AdminPage.tsx` — `save` function
- **Why:** UI state was updated before the API call completed so a failed save left the UI showing incorrect data
- **Fix:** UI is only updated after the server returns the confirmed updated product
- **Trade-offs:** The save feels slightly slower but is always correct

---

### Issue: Stale Closure in Product Search
- **Where:** `frontend/src/pages/ProductsPage.tsx` — `onChange` handler
- **Why:** `load()` was called inside `onChange` and captured the old value of `q` before React updated state so searches were always one keystroke behind
- **Impact:** Search results never matched the current input
- **Fix:** Moved the fetch into a `useEffect` watching `q` directly with a 300ms debounce
- **Trade-offs:** 300ms debounce adds a slight delay but significantly reduces unnecessary API calls

---

### Issue: Floating Point Money Math
- **Where:** `frontend/src/state/CartContext.tsx` — `total` calculation
- **Why:** Multiplying float prices directly causes rounding errors like `0.1 + 0.2 = 0.30000000000000004`
- **Impact:** Cart totals could display and submit incorrect amounts
- **Fix:** Converted each price to integer cents before multiplying then divided back to dollars at the end
- **Trade-offs:** The correct long-term fix is to store all prices as integer cents throughout the database and API

---

## Cross-cutting

### Issue: `key={idx}` Used Throughout
- **Where:** `frontend/src/pages/AdminPage.tsx`, `OrderDetailPage.tsx`, `CartPage.tsx`
- **Why:** Array index was used as React key instead of stable unique IDs
- **Impact:** React cannot correctly track list items on reorder or deletion leading to stale renders and incorrect state
- **Fix:** Replaced `idx` with stable IDs from the data (`item.id`, `p.id`, `o.id`)
- **Trade-offs:** None

---

## What Was Spotted But Not Fixed

- **Rate limiting** on payment endpoints — not implemented. In production `express-rate-limit` should be added
- **HMAC webhook verification** — currently plain string comparison. `crypto.timingSafeEqual` would prevent timing attacks
- **JWT auth** — static admin token works for this scope but production needs expiring tokens with rotation