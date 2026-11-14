const { User, Wallet } = require('../db/models');
const { v4: uuidv4 } = require('uuid');

const firstNames = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Reyansh", "Muhammad", "Sai", "Ayaan", "Krishna",
  "Ishaan", "Shaurya", "Atharva", "Advik", "Pranav", "Advaith", "Aaryan", "Dhruv", "Kabir", "Ritvik",
  "Aanvi", "Ananya", "Diya", "Ira", "Myra", "Saanvi", "Aadhya", "Kiara", "Pari", "Riya",
  "Avni", "Ahana", "Navya", "Shanaya", "Sara", "Tara", "Anika", "Meera", "Zara", "Vanya",
  "Dev", "Rohan", "Karan", "Kunal", "Sameer", "Varun", "Manish", "Rahul", "Naveen", "Abhishek",
  "Suresh", "Ramesh", "Deepak", "Gaurav", "Vikas", "Amit", "Rajesh", "Sunil", "Anil", "Pooja",
  "Neha", "Sneha", "Priya", "Kavita", "Sunita", "Anita", "Deepa", "Rekha", "Shweta", "Ritu",
  "Harsh", "Yash", "Mohit", "Tarun", "Nikhil", "Akash", "Suraj", "Pankaj", "Chetan", "Tushar",
  "Gautam", "Hardik", "Jaspreet", "Kedar", "Lalit", "Mayank", "Nitin", "Omkar", "Parth", "Rishabh",
  "Sachin", "Tanmay", "Udit", "Vijay", "Wasim", "Yuvraj", "Zeeshan", "Alok", "Bhavesh", "Chirag"
];

const middleNamesOrInitials = [
  "Kumar", "Chandra", "Prasad", "Singh", "Nath", "Lal", "Kant", "Deo", "Babu", "Ram",
  "R.", "S.", "K.", "M.", "V.", "P.", "A.", "D.", "J.", "N."
];

const lastNames = [
  "Sharma", "Patel", "Verma", "Rao", "Mehta", "Singh", "Kumar", "Gupta", "Joshi", "Bhatia",
  "Malhotra", "Kapoor", "Chopra", "Reddy", "Nair", "Pillai", "Iyer", "Menon", "Mukherjee", "Chatterjee",
  "Banerjee", "Das", "Dutta", "Roy", "Bose", "Sengupta", "Choudhury", "Mishra", "Pandey", "Trivedi",
  "Deshmukh", "Kulkarni", "Patil", "Pawar", "Shinde", "Jadhav", "Gaekwad", "Chavan", "Bhosale", "More",
  "Agarwal", "Bansal", "Garg", "Goel", "Jindal", "Mittal", "Singhal", "Tayal", "Kansal", "Bindal",
  "Yadav", "Tiwari", "Dubey", "Shukla", "Tripathi", "Pathak", "Chaubey", "Upadhyay", "Awasthi", "Pandit"
];

/**
 * Seed Prime Dreems Autonomous Bots up to targetCount (Default: 10,000 Bots)
 */
async function seedBots(targetCount = 10000) {
  const currentCount = await User.count({ where: { is_bot: true } });
  console.log(`🤖 Current bot count in Prime Dreems: ${currentCount}`);

  if (currentCount >= targetCount) {
    console.log(`✅ Already have ${currentCount} bots (>= ${targetCount}). No additional bots needed.`);
    return currentCount;
  }

  const needed = targetCount - currentCount;
  console.log(`🚀 Seeding ${needed} additional bots for Prime Dreems to reach ${targetCount}...`);

  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  const BATCH_SIZE = 500;
  let batchUsers = [];
  let batchWallets = [];
  let totalCreated = 0;

  for (let i = currentCount + 1; i <= targetCount; i++) {
    const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
    const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
    const mid = Math.random() > 0.6 ? ` ${middleNamesOrInitials[Math.floor(Math.random() * middleNamesOrInitials.length)]}` : '';
    const fullName = `${fn}${mid} ${ln}`;
    const cleanName = fullName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 18);
    const paddedIndex = String(i).padStart(5, '0');
    const email = `bot_${paddedIndex}_${cleanName}@primedreems.bot`;
    const userId = uuidv4();
    const cleanPrefix = fn.slice(0, 3).toUpperCase();
    const refCode = `B${cleanPrefix}${String(i).padStart(5, '0')}`;

    batchUsers.push({
      id: userId,
      name: fullName,
      username: `bot_${paddedIndex}_${cleanName.slice(0, 14)}`,
      role: 'user',
      is_bot: true,
      email,
      password_hash: 'dummy_hash',
      otp_verified: true,
      kyc_status: 'none',
      referral_code: refCode,
      subscription_active_until: oneYearFromNow,
      subscription_type: 'system_unlimited',
      referral_round: 1,
      referrals_in_current_round: 0,
      total_referrals_count: 0,
    });

    batchWallets.push({
      id: uuidv4(),
      user_id: userId,
      balance: 100000.00, // ₹1,00,000 INR balance
      deposit_balance: 100000.00,
      winnings_balance: 0.00,
      bonus_balance: 0.00,
    });

    if (batchUsers.length >= BATCH_SIZE || i === targetCount) {
      await User.bulkCreate(batchUsers);
      await Wallet.bulkCreate(batchWallets);
      totalCreated += batchUsers.length;
      console.log(`📦 Seeded batch: ${totalCreated}/${needed} bots created (Total: ${currentCount + totalCreated})`);
      batchUsers = [];
      batchWallets = [];
    }
  }

  const finalCount = await User.count({ where: { is_bot: true } });
  console.log(`🎉 Successfully seeded! Total Prime Dreems bot count is now: ${finalCount}`);
  return finalCount;
}

module.exports = { seedBots };

if (require.main === module) {
  const target = process.argv[2] ? parseInt(process.argv[2]) : 10000;
  seedBots(target).then(() => process.exit(0)).catch(err => {
    console.error('❌ Seeding error:', err);
    process.exit(1);
  });
}
