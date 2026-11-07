const bcrypt = require('bcryptjs');
const sequelize = require('./db/index');
const { User, Wallet } = require('./db/models');

async function createAccounts() {
  try {
    await sequelize.sync();

    // 1. Admin Account
    const adminEmail = 'admin@primedreems.com';
    const adminPassword = 'Admin@123';
    const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

    let admin = await User.findOne({ where: { email: adminEmail } });
    if (!admin) {
      admin = await User.create({
        name: 'Prime Admin',
        username: 'admin',
        email: adminEmail,
        password_hash: adminPasswordHash,
        role: 'admin',
        otp_verified: true,
      });
      await Wallet.create({
        user_id: admin.id,
        balance: 50000,
      });
      console.log('✅ Created Admin account');
    } else {
      await admin.update({
        username: 'admin',
        role: 'admin',
        password_hash: adminPasswordHash,
        otp_verified: true,
      });
      let adminWallet = await Wallet.findOne({ where: { user_id: admin.id } });
      if (!adminWallet) {
        await Wallet.create({ user_id: admin.id, balance: 50000 });
      } else {
        await adminWallet.update({ balance: Math.max(adminWallet.balance, 50000) });
      }
      console.log('✅ Updated Admin account');
    }

    // 2. Regular User Account
    const userEmail = 'user@primedreems.com';
    const userPassword = 'User@123';
    const userPasswordHash = await bcrypt.hash(userPassword, 10);

    let user = await User.findOne({ where: { email: userEmail } });
    if (!user) {
      user = await User.create({
        name: 'Prime Player',
        username: 'cricket_pro',
        email: userEmail,
        password_hash: userPasswordHash,
        role: 'user',
        otp_verified: true,
      });
      await Wallet.create({
        user_id: user.id,
        balance: 5000,
      });
      console.log('✅ Created User account');
    } else {
      await user.update({
        username: 'cricket_pro',
        role: 'user',
        password_hash: userPasswordHash,
        otp_verified: true,
      });
      let userWallet = await Wallet.findOne({ where: { user_id: user.id } });
      if (!userWallet) {
        await Wallet.create({ user_id: user.id, balance: 5000 });
      } else {
        await userWallet.update({ balance: Math.max(userWallet.balance, 5000) });
      }
      console.log('✅ Updated User account');
    }

    console.log('\n--- ACCOUNTS CREATED SUCCESSFULLY ---');
    console.log('👑 Admin:');
    console.log(`   Email: ${adminEmail} (or Username: admin)`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Role: admin`);
    console.log('\n👤 User:');
    console.log(`   Email: ${userEmail} (or Username: cricket_pro)`);
    console.log(`   Password: ${userPassword}`);
    console.log(`   Role: user`);
    console.log('------------------------------------');

    process.exit(0);
  } catch (err) {
    console.error('Error creating accounts:', err);
    process.exit(1);
  }
}

createAccounts();

