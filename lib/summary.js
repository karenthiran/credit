import { calculateRemainingBalance, determineLoanStatus } from "@/lib/calculations";

// computeDashboardSummary
// Computes all dashboard summary metrics from an array of customer records.
// Parameters:
// - customers: array of customer documents (lean results)
// - nowMs (optional): epoch ms used to determine "current month" boundaries (defaults to Date.now())
// Returns an object with the following fields:
// - totalLoanGiven: total of all `loanAmount` across customers
// - totalCollected: total of all `paidAmount` across customers
// - pendingLoan: sum of remaining balances (clamped >= 0)
// - activeCustomers: count of customers with remaining > 0
// - collectedLast7Days: sum of payments in last 7 days
// - collectedLast30Days: sum of payments in last 30 days
// - profitFromLoanInterest: total profit across all payments
// - monthlyProfit: profit from payments in the current month
// - monthlyCollected: collected amount in the current month
// - monthlyLoanGiven: sum of loan amounts for loans opened in the current month
// - totalCustomers: count of customers
// - monthName: localized month name for the current month window
// - recentTransactions: array of recent transactions (most recent first), each with customerId, customerName, amount, date, note, loanStatus, remaining
export function computeDashboardSummary(customers, nowMs = Date.now()) {
  // --- time boundaries (computed once) ---
  const startOfMonth = new Date(nowMs);
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const monthStartTs = startOfMonth.getTime();

  const startOfToday = new Date(nowMs);
  startOfToday.setHours(0, 0, 0, 0);
  const todayStartTs = startOfToday.getTime();

  const now = nowMs;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  // --- aggregated counters ---
  let totalLoanGiven = 0;
  let totalCollected = 0;
  let pendingLoan = 0;
  let activeCustomers = 0;
  let profitFromLoanInterest = 0;
  let monthlyProfit = 0;
  let monthlyCollected = 0;
  let monthlyLoanGiven = 0;
  let collectedLast30Days = 0;
  let collectedLast7Days = 0;
  let todaysCollected = 0;
  let todaysProfit = 0;

  // Unified, normalized transactions array. Each item will have a pre-parsed
  // timestamp and numeric amount so we only do conversions once.
  const normalizedTransactions = [];

  // --- Normalization pass (O(customers + transactions)) ---
  // For each customer we:
  // - compute customer-level derived values once (interestRate, remaining, loanStatus)
  // - accumulate customer-level aggregates (totalLoanGiven, totalCollected, pendingLoan, activeCustomers)
  // - push normalized transaction records for both current loan and loanHistory
  for (const customer of customers) {
    const loanAmount = Number(customer.loanAmount || 0);
    const paidAmount = Number(customer.paidAmount || 0);

    // remaining and loan status for the customer's current loan
    const remaining = calculateRemainingBalance(customer.totalWithInterest, customer.paidAmount);
    const customerLoanStatus = determineLoanStatus(remaining);
    const customerInterestRate = Number(customer.interestRate || 0);

    // customer-level aggregates (computed once)
    // Include both the customer's current loan and any historical loans
    // so `totalLoanGiven` reflects all loan amounts ever granted to this customer.
    const historyLoanSum = (customer.loanHistory ?? []).reduce(
      (sum, l) => sum + Number(l.loanAmount || 0),
      0,
    );
    totalLoanGiven += loanAmount + historyLoanSum;
    totalCollected += paidAmount;
    pendingLoan += remaining;
    if (remaining > 0) activeCustomers += 1;

    // monthlyLoanGiven uses loanStartDate to track when the loan was actually started
    const loanStartTs = Number(new Date(customer.loanStartDate || customer.createdAt).getTime());
    if (!Number.isNaN(loanStartTs) && loanStartTs >= monthStartTs) {
      monthlyLoanGiven += loanAmount;
    }

    // Normalize current loan transactions into unified shape
    for (const txn of customer.transactions ?? []) {
      const ts = Number(new Date(txn.date).getTime());
      if (Number.isNaN(ts)) continue;

      normalizedTransactions.push({
        ts,
        amount: Number(txn.amount || 0),
        profit: Number(txn.profit || 0),
        dateIso: new Date(ts).toISOString(),
        note: txn.note,
        customerId: String(customer.customerId ?? ""),
        customerName: String(customer.name ?? "Unknown"),
        interestRate: customerInterestRate,
        loanStatus: customerLoanStatus,
        remaining,
      });
    }

    // Normalize historical loans and their transactions. Compute loan-specific
    // remaining and status once per loan and reuse for all its transactions.
    for (const loan of customer.loanHistory ?? []) {
      const loanRemaining = calculateRemainingBalance(loan.totalWithInterest, loan.paidAmount);
      const loanStatus = loan.status ?? determineLoanStatus(loanRemaining);
      const loanInterestRate = Number(loan.interestRate ?? customer.interestRate ?? 0);

      for (const txn of loan.transactions ?? []) {
        const ts = Number(new Date(txn.date).getTime());
        if (Number.isNaN(ts)) continue;

        normalizedTransactions.push({
          ts,
          amount: Number(txn.amount || 0),
          profit: Number(txn.profit || 0),
          dateIso: new Date(ts).toISOString(),
          note: txn.note,
          customerId: String(customer.customerId ?? ""),
          customerName: String(customer.name ?? "Unknown"),
          interestRate: loanInterestRate,
          loanStatus,
          remaining: loanRemaining,
        });
      }
    }
  }

  // --- Single-pass aggregation over normalized transactions (O(transactions)) ---
  for (const tx of normalizedTransactions) {
    const { ts, amount, interestRate } = tx;

    // profit is stored on the transaction at payment time
    const profit = Number(tx.profit || 0);
    profitFromLoanInterest += profit;

    if (ts >= monthStartTs) {
      monthlyCollected += amount;
      monthlyProfit += profit;
    }

    if (ts >= thirtyDaysAgo) collectedLast30Days += amount;
    if (ts >= sevenDaysAgo) collectedLast7Days += amount;
    
    if (ts >= todayStartTs) {
      todaysCollected += amount;
      todaysProfit += profit;
    }
  }

  // --- prepare recent transactions: sort by timestamp desc and pick top 5 ---
  normalizedTransactions.sort((a, b) => b.ts - a.ts);
  const recentTransactions = normalizedTransactions.slice(0, 5).map((t, idx) => ({
    txId: `${t.customerId}-${t.ts}-${t.amount}-${idx}`,
    customerId: t.customerId,
    customerName: t.customerName,
    amount: t.amount,
    date: t.dateIso,
    note: t.note,
    loanStatus: t.loanStatus,
    remaining: t.remaining,
  }));

  // --- final output matches original shape ---
  return {
    totalLoanGiven,
    totalCollected,
    pendingLoan,
    activeCustomers,
    collectedLast7Days,
    collectedLast30Days,
    profitFromLoanInterest,
    monthlyProfit,
    monthlyCollected,
    monthlyLoanGiven,
    todaysCollected,
    todaysProfit,
    totalCustomers: customers.length,
    monthName: startOfMonth.toLocaleString(undefined, { month: "long" }),
    recentTransactions,
  };
}

