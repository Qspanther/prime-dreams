const bcrypt = require('bcryptjs');
const { User, Wallet } = require('./models');

async function seedDefaultUsers() {
  const defaultAccounts = [
    {
      name: 'Prime Dreems Admin',
      username: 'admin',
      email: 'admin@primedreems.com',
      password: 'Admin@123',
      role: 'admin',
      is_bot: false,
      otp_verified: true,
      kyc_status: 'verified',
      age: 28,
      balance: 500000,
      deposit_balance: 300000,
      winnings_balance: 100000,
      bonus_balance: 100000,
    },
    {
      name: 'Rahul Sharma',
      username: 'cricket_user',
      email: 'user@primedreems.com',
      password: 'User@123',
      role: 'user',
      is_bot: false,
      otp_verified: true,
      kyc_status: 'verified',
      age: 24,
      balance: 50000,
      deposit_balance: 30000,
      winnings_balance: 10000,
      bonus_balance: 10000,
    },
    {
      name: 'Virat King 18',
      username: 'cricket_pro',
      email: 'player@primedreems.com',
      password: 'User@123',
      role: 'user',
      is_bot: false,
      otp_verified: true,
      kyc_status: 'verified',
      age: 26,
      balance: 100000,
      deposit_balance: 50000,
      winnings_balance: 30000,
      bonus_balance: 20000,
    },
  ];

  for (const acc of defaultAccounts) {
    let user = await User.findOne({ where: { email: acc.email } });
    const hash = await bcrypt.hash(acc.password, 10);
    if (!user) {
      user = await User.create({
        name: acc.name,
        username: acc.username,
        email: acc.email,
        password_hash: hash,
        role: acc.role,
        is_bot: false,
        otp_verified: true,
        kyc_status: acc.kyc_status,
        age: acc.age,
        subscription_active_until: new Date(Date.now() + 365 * 24 * 3600 * 1000),
        subscription_type: 'Prime VIP Pass',
        subscription_max_teams: 6,
      });
      console.log('✅ Created User:', acc.email, 'Role:', acc.role);
    } else {
      await user.update({
        name: acc.name,
        username: acc.username,
        password_hash: hash,
        role: acc.role,
        is_bot: false,
        otp_verified: true,
        kyc_status: acc.kyc_status,
        age: acc.age,
        subscription_active_until: user.subscription_active_until || new Date(Date.now() + 365 * 24 * 3600 * 1000),
        subscription_type: user.subscription_type && user.subscription_type !== 'none' ? user.subscription_type : 'Prime VIP Pass',
        subscription_max_teams: user.subscription_max_teams || 6,
      });
      console.log('🔄 Updated User:', acc.email, 'Role:', acc.role);
    }

    let wallet = await Wallet.findOne({ where: { user_id: user.id } });
    if (!wallet) {
      await Wallet.create({
        user_id: user.id,
        balance: acc.balance,
        deposit_balance: acc.deposit_balance,
        winnings_balance: acc.winnings_balance,
        bonus_balance: acc.bonus_balance,
      });
      console.log('💰 Created Wallet for:', acc.email, 'Balance: ₹' + acc.balance);
    } else {
      await wallet.update({
        balance: acc.balance,
        deposit_balance: acc.deposit_balance,
        winnings_balance: acc.winnings_balance,
        bonus_balance: acc.bonus_balance,
      });
      console.log('💰 Updated Wallet for:', acc.email, 'Balance: ₹' + acc.balance);
    }
  }
}

module.exports = { seedDefaultUsers };

if (require.main === module) {
  seedDefaultUsers()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
