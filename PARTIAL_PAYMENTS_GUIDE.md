# Partial Payments Feature Guide

## 🎉 What's New

Your fee collection app has been completely revamped to support **partial payments**! Students can now make multiple payments for the same fee head until fully paid.

## 📋 Key Changes

### Backend (Code.gs)

1. **New Function: `getPaymentStatus()`**
   - Replaces binary paid/unpaid logic
   - Returns: `{ totalPaid, totalFine, payments[], isFullyPaid, balance }`
   - Aggregates all non-voided payments for a fee head

2. **Updated Payment Validation**
   - OLD: Block if any payment exists
   - NEW: Allow payments until `totalPaid >= expectedAmount`
   - Error changed from `duplicate_payment` to `already_fully_paid`

3. **Enhanced Fee Status API**
   - Returns detailed payment breakdown per fee head
   - Shows: `expectedAmount`, `amountPaid`, `balance`, `payments[]`
   - Indicates: `paid`, `partiallyPaid` status

### Frontend

1. **Payment Collection UI**
   - ✅ Green badge: Fully Paid fees (unselectable)
   - 🟡 Amber badge: Partially Paid fees (selectable, shows balance)
   - ⬜ White: Unpaid fees (selectable)
   - Shows payment history for partial fees

2. **Student Fee Status**
   - New columns: Expected, Paid, Balance
   - Lists all payments per fee head
   - Summary includes: `totalExpected`, `totalPaid`, `totalBalance`

## 🔍 How It Works

### Example Scenario (Your December Fee Issue):

**Fee Structure:**
- December fee: ₹2,000

**Payment 1:** (Receipt R02682)
- Date: 2025-12-15
- Amount: ₹1,000
- Status: **Partially Paid** (Balance: ₹1,000)

**Payment 2:** (Future)
- Date: TBD
- Amount: ₹1,000
- Status: **Fully Paid** (Balance: ₹0)

### API Response for Partial Payment:

```json
{
  "feeHead": "December",
  "expectedAmount": 2000,
  "amountPaid": 1000,
  "balance": 1000,
  "paid": false,
  "partiallyPaid": true,
  "payments": [
    {
      "date": "2025-12-15",
      "receiptNo": "R02682",
      "amount": 1000,
      "fine": 0
    }
  ]
}
```

## 🚀 Testing Steps

1. **Deploy Updated Code.gs**
   - Copy entire Code.gs to Apps Script
   - Deploy as Web App (new version)

2. **Test Partial Payment**
   ```
   1. Select student (admNo: 5902, Hareendra, Class 5A)
   2. Check December fee - should show:
      ⚠️ Partially Paid ₹1,000 / ₹2,000 • Balance ₹1,000
   3. Select December checkbox
   4. Enter ₹1,000 (remaining balance)
   5. Submit payment
   6. Verify: December now shows ✅ Fully Paid ₹2,000
   ```

3. **Test Fee Status Tab**
   ```
   1. Go to "Fee Status" tab
   2. Enter admission: 5902
   3. Check Status
   4. Should show all payments for December with individual receipts
   ```

## 📊 Database Impact

### Transactions Sheet
No schema changes needed! The app now:
- Reads ALL transactions for a student+feeHead
- Sums amounts to check if fully paid
- Allows multiple rows for same fee head

### Example Transactions:
| Date | Receipt | AdmNo | FeeHead | Amount |
|------|---------|-------|---------|--------|
| 2025-12-15 | R02682 | 5902 | December | 1000 |
| 2025-12-20 | R02710 | 5902 | December | 1000 |

**Result:** December fully paid (₹2,000 total)

## 🔧 API Endpoints Updated

### 1. `?action=checkPayment`
```javascript
// Returns
{
  ok: true,
  totalPaid: 1000,
  balance: 1000,
  isFullyPaid: false,
  isPartiallyPaid: true,
  payments: [...]
}
```

### 2. `?action=studentFeeStatus`
```javascript
// Returns
{
  ok: true,
  student: {...},
  feeStatus: [{
    feeHead: "December",
    expectedAmount: 2000,
    amountPaid: 1000,
    balance: 1000,
    paid: false,
    partiallyPaid: true,
    payments: [...]
  }],
  summary: {
    totalExpected: 10000,
    totalPaid: 9000,
    totalBalance: 1000,
    hasPartialPayments: true
  }
}
```

### 3. `POST action=addPaymentBatch`
Now allows payments for partially paid fees. Response includes:
```javascript
{
  ok: true,
  receiptNo: "R02710",
  partialPayments: [{
    feeHead: "December",
    previouslyPaid: 1000,
    newPayment: 1000,
    balance: 0
  }]
}
```

## ⚠️ Important Notes

1. **Voided Payments**: Still excluded from balance calculations
2. **Over-payment Protection**: System checks if `totalPaid >= expectedAmount`
3. **Multiple Receipts**: Each partial payment gets its own receipt number
4. **Backward Compatibility**: `isFeePaid()` wrapper maintained for legacy code

## 🎨 UI Color Coding

- 🟢 Green: Fully paid fees
- 🟡 Amber: Partially paid fees (action required)
- 🔴 Red: Unpaid fees
- ⚪ Gray: Voided transactions

## 💡 Benefits

1. ✅ Flexible payment collection
2. ✅ Clear balance tracking
3. ✅ Complete payment history
4. ✅ No duplicate receipts
5. ✅ Accurate financial reporting

---

**Last Updated:** December 16, 2025
**Version:** 2.0 (Partial Payments)
