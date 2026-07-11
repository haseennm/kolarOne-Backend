const assert = require('assert');
const { buildAuditChanges, buildJournalMessage } = require('../dist/module/journal/journal.utils');

const oldRecord = {
  product_name: 'Dell Laptop',
  price: 50000,
  stock: 10,
  status: 'Active',
  created_at: '2024-01-01',
  password: 'secret',
};

const newRecord = {
  product_name: 'Dell Laptop',
  price: 55000,
  stock: 15,
  status: 'Inactive',
  created_at: '2024-01-01',
  password: 'secret',
};

const changes = buildAuditChanges(oldRecord, newRecord);
assert.deepStrictEqual(changes, {
  price: { old: 50000, new: 55000 },
  stock: { old: 10, new: 15 },
  status: { old: 'Active', new: 'Inactive' },
});

const message = buildJournalMessage('products', 'create', { name: 'Dell Laptop' });
assert.strictEqual(message, 'Product "Dell Laptop" created.');

const paymentMethodMessage = buildJournalMessage('payment_methods', 'create', { name: 'Cash' });
assert.strictEqual(paymentMethodMessage, 'Payment method "Cash" created.');

const loanRepayMessage = buildJournalMessage('staff_loans', 'repay', { staff_name: 'John Doe', loan_amount: 50000 });
assert.strictEqual(loanRepayMessage, 'Loan repayment of 50000 recorded for "John Doe".');

const partyBalanceRepayMessage = buildJournalMessage('party_balance', 'repay', { party_name: 'ABC Ltd', balance: 2500 });
assert.strictEqual(partyBalanceRepayMessage, 'Party balance repayment of 2500 recorded for "ABC Ltd".');

console.log('journal utils tests passed');
