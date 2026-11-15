// 💰 Parameterized Wallet & Ledger Queries for PostgreSQL
const db = require('../pg');

async function getWalletByUserId(userId) {
  const res = await db.query(
    'SELECT * FROM wallets WHERE user_id = $1 LIMIT 1;',
    [userId]
  );
  return res.rows[0] || null;
}

/**
 * Atomic wallet deduction inside a transaction with ledger record
 */
async function deductWalletBalance(userId, amount, description, referenceId = null) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 1. Lock wallet row FOR UPDATE
    const wRes = await client.query(
      'SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE;',
      [userId]
    );
    const wallet = wRes.rows[0];
    if (!wallet) throw new Error('Wallet not found');

    const totalBal = parseFloat(wallet.balance) + parseFloat(wallet.bonus_balance || 0);
    const needed = parseFloat(amount);
    if (totalBal < needed) {
      throw new Error(`Insufficient wallet balance. Available: ₹${totalBal}, Required: ₹${needed}`);
    }

    // Deduct from bonus first, then main balance
    let deductBonus = Math.min(parseFloat(wallet.bonus_balance || 0), needed);
    let deductMain = needed - deductBonus;

    const newMain = parseFloat(wallet.balance) - deductMain;
    const newBonus = parseFloat(wallet.bonus_balance || 0) - deductBonus;

    await client.query(
      `UPDATE wallets 
       SET balance = $1, bonus_balance = $2, updated_at = NOW() 
       WHERE id = $3;`,
      [newMain, newBonus, wallet.id]
    );

    // 2. Insert transaction ledger record
    await client.query(
      `INSERT INTO transactions (id, wallet_id, type, amount, status, description, reference_id, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'entry_fee', $2, 'completed', $3, $4, NOW(), NOW());`,
      [wallet.id, needed, description, referenceId]
    );

    await client.query('COMMIT');
    return { success: true, balance: newMain, bonus_balance: newBonus };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getWalletByUserId,
  deductWalletBalance,
};
