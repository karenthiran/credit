# Calculation Logic Report

This document maps every calculation currently used in the system, where it lives, how data flows through it, and which files must be updated when calculation behavior changes.

## High-Level Model

The system stores the core loan fields on each customer record and then recomputes derived values in a few different places:

- Loan creation and loan edits compute the payable amount and installment values.
- Payment routes update `paidAmount` and the transaction list.
- Dashboard and profit screens read all customers and recompute aggregates from stored values.
- Customer detail screens derive balances, completion state, repayment progress, and history displays.
- Customer ID generation uses a counter document plus the highest existing customer ID.

The main rule is that the database stores the underlying loan facts, while most totals and summaries are derived at request time or render time.

## Files That Contain Calculation Logic

These are the main files that either compute values directly or depend on computed fields:

- [components/AddCustomerDialog.tsx](components/AddCustomerDialog.tsx)
- [components/AddLoanDialog.tsx](components/AddLoanDialog.tsx)
- [app/api/customers/route.ts](app/api/customers/route.ts)
- [app/api/customers/[id]/route.ts](app/api/customers/[id]/route.ts)
- [app/api/customers/[id]/payments/route.ts](app/api/customers/[id]/payments/route.ts)
- [app/api/customers/next-id/route.ts](app/api/customers/next-id/route.ts)
- [app/api/dashboard/summary/route.ts](app/api/dashboard/summary/route.ts)
- [app/api/dashboard/profits/route.ts](app/api/dashboard/profits/route.ts)
- [app/(dashboard)/customers/[id]/page.tsx](<app/(dashboard)/customers/[id]/page.tsx>)
- [app/(dashboard)/dashboard/page.tsx](<app/(dashboard)/dashboard/page.tsx>)
- [app/(dashboard)/profits/page.tsx](<app/(dashboard)/profits/page.tsx>)
- [lib/model/customerModel.js](lib/model/customerModel.js)
- [lib/model/counterModel.js](lib/model/counterModel.js)

## Calculation Summary

| Calculation                            | Formula / Rule                                                           | Where it is used                                                          |
| -------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Total interest                         | `loanAmount * (interestRate / 100) * duration`                           | Customer creation, loan creation UI                                       |
| Total payable amount                   | `loanAmount + totalInterest`                                             | Customer creation, loan creation UI, customer detail fallback             |
| Monthly payment                        | `totalWithInterest / duration` when `duration > 0`, otherwise `0`        | Customer creation, loan creation UI, new loan flow                        |
| Daily payment                          | `totalWithInterest / (duration * 30)` when `duration > 0`, otherwise `0` | Customer creation, loan creation UI, new loan flow                        |
| Remaining balance                      | `max(totalWithInterest - paidAmount, 0)`                                 | Customer detail, dashboard summary, loan history, status derivation       |
| Completion status                      | `remaining > 0 ? "ongoing" : "completed"`                                | Customer serialization, customer detail, dashboard summary, profit report |
| Repayment progress                     | `round((paidAmount / totalWithInterest) * 100)` clamped to `0..100`      | Customer detail page                                                      |
| Loan finish date                       | `loanStartDate + duration months`                                        | Customer detail page                                                      |
| Payment profit                         | `(paymentAmount / (100 + interestRate)) * interestRate`                  | Dashboard summary, profits report                                         |
| Monthly loan given                     | Sum of `loanAmount` for customers created during the current month       | Dashboard summary                                                         |
| Monthly collected                      | Sum of transaction amounts in the current month                          | Dashboard summary                                                         |
| Collected last 7/30 days               | Sum of transaction amounts in the last 7 or 30 days                      | Dashboard summary                                                         |
| Total loan given / collected / pending | Sums across all customers                                                | Dashboard summary                                                         |
| Profit by range                        | Sum of per-payment profit across a filtered date range                   | Profit report                                                             |
| Next customer ID                       | `max(counter seq, highest existing customerId) + 1`                      | Next customer ID endpoint, add-customer dialog                            |

## Detailed Explanation Of Each Calculation

### 1. Loan Creation Formula

The loan creation flow computes four key values:

- `totalInterest = loanAmount * (interestRate / 100) * duration`
- `totalWithInterest = loanAmount + totalInterest`
- `monthlyPayment = totalWithInterest / duration` when `duration > 0`
- `dailyPayment = totalWithInterest / (duration * 30)` when `duration > 0`

This formula is duplicated in both the client preview and the server write path so the UI preview and the saved record match.

Where it appears:

- [components/AddCustomerDialog.tsx](components/AddCustomerDialog.tsx)
- [app/api/customers/route.ts](app/api/customers/route.ts)
- [app/api/customers/[id]/route.ts](app/api/customers/[id]/route.ts) for the `newLoan` branch

How the data flows:

1. The user types loan amount, interest rate, and duration in the add-customer dialog.
2. The dialog computes a preview locally.
3. On submit, the dialog sends the raw inputs plus the computed values to `POST /api/customers`.
4. The API recalculates the same values before storing the customer.
5. The saved values become the source of truth for later dashboard, customer detail, and profit calculations.

### 2. Loan Update And New Loan Formula

The customer update route has two calculation behaviors:

- If `newLoan` is set, it closes the previous loan into `loanHistory` and creates a fresh loan using the same loan formula as creation.
- If `newLoan` is not set, it updates fields directly from the request body and does not recompute them automatically.

This means calculation behavior can change in two places: the server branch that handles new loans, and any UI that prepares the payload.

Where it appears:

- [app/api/customers/[id]/route.ts](app/api/customers/[id]/route.ts)
- [components/AddLoanDialog.tsx](components/AddLoanDialog.tsx)
- [app/(dashboard)/customers/[id]/page.tsx](<app/(dashboard)/customers/[id]/page.tsx>) for display of the result

How the data flows:

1. The customer detail page enables the Add Loan action only when the current loan is fully paid.
2. The dialog sends `newLoan: true` plus the new loan inputs.
3. The server snapshots the previous loan into `loanHistory`.
4. The server computes the new loan totals and resets `paidAmount` and `transactions` to zero/empty.
5. The updated record becomes the current loan and the old loan becomes historical data.

### 3. Outstanding Balance And Completion State

The system derives the remaining balance as:

- `remaining = max(totalWithInterest - paidAmount, 0)`

Completion state is derived from that remaining balance:

- `remaining > 0` means the loan is `ongoing`
- `remaining <= 0` means the loan is `completed`

Where it appears:

- [app/api/customers/route.ts](app/api/customers/route.ts) in `serializeCustomer`
- [app/api/customers/[id]/route.ts](app/api/customers/[id]/route.ts) in `serializeCustomer` and `buildLoanSnapshot`
- [app/api/dashboard/summary/route.ts](app/api/dashboard/summary/route.ts)
- [app/(dashboard)/customers/[id]/page.tsx](<app/(dashboard)/customers/[id]/page.tsx>)
- [app/api/dashboard/profits/route.ts](app/api/dashboard/profits/route.ts)

How the data flows:

1. `paidAmount` is updated when payments are recorded or edited.
2. Read paths recompute the balance on demand.
3. The balance drives status labels, progress bars, and dashboard totals.
4. Completed loans move into history when a new loan is created.

### 4. Payment Recording And Payment Editing

The payment endpoint changes loan progress in two ways:

- `POST /api/customers/[id]/payments` adds a new transaction and increments `paidAmount` by the payment amount.
- `PUT /api/customers/[id]/payments` replaces a transaction and then recomputes `paidAmount` as the sum of all transaction amounts.

The update path is important because it uses the transaction list as the source of truth for the total collected amount.

Where it appears:

- [app/api/customers/[id]/payments/route.ts](app/api/customers/[id]/payments/route.ts)

How the data flows:

1. A payment request arrives with an amount, optional date, and optional note.
2. The server validates the customer and payment amount.
3. For creates, the amount is appended to `transactions` and added to `paidAmount`.
4. For edits, the transaction at the selected index is replaced and `paidAmount` is recalculated from scratch.
5. Downstream readers use the updated `paidAmount` and transaction history to recompute balance, status, and profit.

### 5. Dashboard Aggregates

The dashboard summary endpoint loops over all customers and computes portfolio totals:

- `totalLoanGiven += loanAmount`
- `totalCollected += paidAmount`
- `pendingLoan += remaining`
- `activeCustomers += 1` when remaining is greater than zero
- `monthlyLoanGiven += loanAmount` for customers created in the current month
- `monthlyCollected += paymentAmount` for transactions in the current month
- `collectedLast30Days += paymentAmount` for transactions in the last 30 days
- `collectedLast7Days += paymentAmount` for transactions in the last 7 days
- `profitFromLoanInterest += paymentProfit`
- `monthlyProfit += paymentProfit` for current-month transactions

Where it appears:

- [app/api/dashboard/summary/route.ts](app/api/dashboard/summary/route.ts)
- [app/(dashboard)/dashboard/page.tsx](<app/(dashboard)/dashboard/page.tsx>)

How the data flows:

1. The dashboard page fetches `/api/dashboard/summary` on mount.
2. The endpoint loads all customers and their transactions.
3. It recomputes portfolio metrics from stored customer records.
4. The page renders those totals directly; it does not recalculate business values itself.

### 6. Profit Report Calculations

The profits endpoint computes profit per payment using interest and the payment amount:

- `profit = (paymentAmount / (100 + interestRate)) * interestRate`

The endpoint applies that formula to two sets of payments:

- Current loan transactions from `customer.transactions`
- Historical loan transactions from `customer.loanHistory`

It then filters those rows by the selected date range and aggregates totals:

- `totalProfit`
- `totalProfitOngoing`
- `totalProfitCompleted`
- `totalPayments`
- `totalPaymentsOngoing`
- `totalPaymentsCompleted`

Where it appears:

- [app/api/dashboard/profits/route.ts](app/api/dashboard/profits/route.ts)
- [app/(dashboard)/profits/page.tsx](<app/(dashboard)/profits/page.tsx>)

How the data flows:

1. The profits page selects a filter such as today, last 7 days, custom range, or month.
2. The page requests `/api/dashboard/profits` with the filter parameters.
3. The endpoint filters transactions by date and computes per-row profit.
4. The page renders the rows and summary totals returned by the server.

### 7. Customer Detail Calculations

The customer detail page performs several presentation-side calculations:

- `totalWithInterest` fallback: if the stored value is missing, it recalculates from `loanAmount`, `interestRate`, and `duration`
- `remaining = totalWithInterest - paidAmount`
- `isLoanComplete = remaining <= 0`
- `percentPaid = round((paidAmount / totalWithInterest) * 100)`, clamped to `0..100`
- `loanFinishDate = loanStartDate + duration months`
- `balance` in each loan card uses `max(totalWithInterest - paidAmount, 0)`
- daily ledger rows group transaction amounts by day

Where it appears:

- [app/(dashboard)/customers/[id]/page.tsx](<app/(dashboard)/customers/[id]/page.tsx>)

How the data flows:

1. The page loads a single customer record server-side.
2. It computes balance, progress, and dates for display.
3. It decides whether to show Add Loan or the locked message.
4. It renders loan history and daily transaction history from stored data.

### 8. Customer ID Calculations

The customer ID system is also a calculation, even though it is not financial.

There are three related behaviors:

- The counter model stores a `seq` value for the next customer ID.
- The customer model pre-save hook assigns the next `customerId` to a new customer.
- The next-id endpoint computes `nextCustomerId = max(counter seq, highest existing customerId) + 1`.

Where it appears:

- [lib/model/counterModel.js](lib/model/counterModel.js)
- [lib/model/customerModel.js](lib/model/customerModel.js)
- [app/api/customers/next-id/route.ts](app/api/customers/next-id/route.ts)
- [app/api/customers/route.ts](app/api/customers/route.ts) in `backfillCustomerIds`
- [components/AddCustomerDialog.tsx](components/AddCustomerDialog.tsx)

How the data flows:

1. The add-customer dialog fetches `/api/customers/next-id` to show the next ID.
2. The customer creation route backfills missing IDs before creating or reading customers.
3. The schema hook assigns a fresh sequential ID to new customers.
4. The next-id endpoint protects against drift between the counter document and the highest stored ID.

## Which Files Should Be Modified To Change Calculation Behavior

If a developer wants to change a calculation, these are the files that usually need coordinated updates:

### Loan Formula Changes

- [components/AddCustomerDialog.tsx](components/AddCustomerDialog.tsx)
- [app/api/customers/route.ts](app/api/customers/route.ts)
- [app/api/customers/[id]/route.ts](app/api/customers/[id]/route.ts)
- [app/(dashboard)/customers/[id]/page.tsx](<app/(dashboard)/customers/[id]/page.tsx>)

### Payment And Balance Changes

- [app/api/customers/[id]/payments/route.ts](app/api/customers/[id]/payments/route.ts)
- [app/api/dashboard/summary/route.ts](app/api/dashboard/summary/route.ts)
- [app/api/dashboard/profits/route.ts](app/api/dashboard/profits/route.ts)
- [app/(dashboard)/customers/[id]/page.tsx](<app/(dashboard)/customers/[id]/page.tsx>)

### Dashboard Summary Changes

- [app/api/dashboard/summary/route.ts](app/api/dashboard/summary/route.ts)
- [app/(dashboard)/dashboard/page.tsx](<app/(dashboard)/dashboard/page.tsx>)

### Profit Report Changes

- [app/api/dashboard/profits/route.ts](app/api/dashboard/profits/route.ts)
- [app/(dashboard)/profits/page.tsx](<app/(dashboard)/profits/page.tsx>)

### Customer ID Changes

- [lib/model/counterModel.js](lib/model/counterModel.js)
- [lib/model/customerModel.js](lib/model/customerModel.js)
- [app/api/customers/route.ts](app/api/customers/route.ts)
- [app/api/customers/next-id/route.ts](app/api/customers/next-id/route.ts)
- [components/AddCustomerDialog.tsx](components/AddCustomerDialog.tsx)

## Practical Maintenance Notes

- The loan formula is duplicated in multiple places. If it changes, update both the client preview and the server write paths together.
- `paidAmount` is the key downstream field. Anything that changes how payments are recorded must keep `paidAmount` and `transactions` consistent.
- Dashboard and profit pages intentionally recompute from stored records instead of trusting cached totals.
- The customer detail page contains display-side calculations that should stay aligned with server-side balance logic.
- The customer schema does not compute loan totals itself; it only stores fields and assigns a `customerId` on create.

## Quick Reference

If you only need the main business formulas, they are:

```text
totalInterest = loanAmount * (interestRate / 100) * duration
totalWithInterest = loanAmount + totalInterest
monthlyPayment = duration > 0 ? totalWithInterest / duration : 0
dailyPayment = duration > 0 ? totalWithInterest / (duration * 30) : 0
remaining = max(totalWithInterest - paidAmount, 0)
profit = (paymentAmount / (100 + interestRate)) * interestRate
nextCustomerId = max(counter seq, highest existing customerId) + 1
```
