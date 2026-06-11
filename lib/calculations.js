export function calculateTotalInterest(principal, monthlyRatePercent, months) {
  const loan = Number(principal) || 0;
  const rate = Number(monthlyRatePercent) || 0;
  const duration = Number(months) || 0;

  return loan * (rate / 100) * duration;
}

export function calculateTotalWithInterest(principal, monthlyRatePercent, months) {
  return Number(principal) + calculateTotalInterest(principal, monthlyRatePercent, months);
}

export function calculateMonthlyPayment(totalWithInterest, months) {
  const total = Number(totalWithInterest) || 0;
  const duration = Number(months) || 0;

  return duration > 0 ? total / duration : 0;
}

export function calculateDailyPayment(totalWithInterest, months) {
  const total = Number(totalWithInterest) || 0;
  const duration = Number(months) || 0;

  return duration > 0 ? total / (duration * 30) : 0;
}

export function calculateLoanSummary(principal, monthlyRatePercent, months) {
  const totalInterest = calculateTotalInterest(principal, monthlyRatePercent, months);
  const totalWithInterest = Number(principal) + totalInterest;

  return {
    totalInterest,
    totalWithInterest,
    monthlyPayment: calculateMonthlyPayment(totalWithInterest, months),
    dailyPayment: calculateDailyPayment(totalWithInterest, months),
  };
}

// Calculates the outstanding balance for a loan after payments.
// This clamps to zero so the remaining balance never becomes negative.
export function calculateRemainingBalance(totalWithInterest, paidAmount) {
  return Math.max(
    Number(totalWithInterest || 0) - Number(paidAmount || 0),
    0,
  );
}

// Returns the human-readable status of a loan based on remaining balance.
export function determineLoanStatus(remainingBalance) {
  return remainingBalance > 0 ? "ongoing" : "completed";
}

// Calculates the interest portion of a payment amount.
// This assumes the payment includes both principal and interest,
// and derives the interest share using the loan's monthly rate.
// export function calculatePaymentInterestProfit(paymentAmount, interestRatePercent) {
//   const amount = Number(paymentAmount || 0);
//   const rate = Number(interestRatePercent || 0);

//   return rate > 0 ? (amount / (100 + rate)) * rate : 0;
// }

export function calculatePaymentInterestProfit(paymentAmount, interestRatePercent, numberOfMonths) {
  const n = Number(paymentAmount || 0);
  const a = Number(interestRatePercent || 0);
  const months = Number(numberOfMonths || 0);

  // Calculate total interest multiplier (a * no. of months)
  const totalInterestFactor = a * months;

  // Prevent division by zero or negative values if inputs are invalid
  if (n <= 0 || (100 + totalInterestFactor) <= 0) {
    return 0;
  }

  // Formula: [n / (100 + (a * months))] * (a * months)
  return (n / (100 + totalInterestFactor)) * totalInterestFactor;
}