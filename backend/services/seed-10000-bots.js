// ★★★ PRIME DREEMS — REALISTIC 10,000 INDIAN BOTS SEEDER ★★★
// Generates 10,000 realistic Indian cricket fantasy bots with authentic Indian names,
// 100% unique @gmail.com email addresses, authentic handles, and ₹1,00,000 INR wallets.

const { User, Wallet } = require('../db/models');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const firstNames = [
  // Modern & Classic Indian Male Names
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Reyansh", "Muhammad", "Sai", "Ayaan", "Krishna",
  "Ishaan", "Shaurya", "Atharva", "Advik", "Pranav", "Advaith", "Aaryan", "Dhruv", "Kabir", "Ritvik",
  "Dev", "Rohan", "Karan", "Kunal", "Sameer", "Varun", "Manish", "Rahul", "Naveen", "Abhishek",
  "Suresh", "Ramesh", "Deepak", "Gaurav", "Vikas", "Amit", "Rajesh", "Sunil", "Anil", "Harsh",
  "Yash", "Mohit", "Tarun", "Nikhil", "Akash", "Suraj", "Pankaj", "Chetan", "Tushar", "Gautam",
  "Hardik", "Jaspreet", "Kedar", "Lalit", "Mayank", "Nitin", "Omkar", "Parth", "Rishabh", "Sachin",
  "Tanmay", "Udit", "Vijay", "Wasim", "Yuvraj", "Zeeshan", "Alok", "Bhavesh", "Chirag", "Dinesh",
  "Eshwar", "Farhan", "Giridhar", "Himanshu", "Inderjeet", "Jatin", "Kailash", "Lokesh", "Manoj",
  "Neeraj", "Ojas", "Praveen", "Qasim", "Rakesh", "Siddharth", "Tejas", "Utkarsh", "Vicky", "Waqar",
  "Yogesh", "Zuber", "Anurag", "Brijesh", "Chandan", "Darshan", "Girish", "Hemant", "Jagdish", "Kapil",
  "Madhav", "Narendra", "Pradeep", "Raghav", "Sandeep", "Trilok", "Vimal", "Vishal", "Yashwant",

  // Modern & Classic Indian Female Names
  "Aanvi", "Ananya", "Diya", "Ira", "Myra", "Saanvi", "Aadhya", "Kiara", "Pari", "Riya",
  "Avni", "Ahana", "Navya", "Shanaya", "Sara", "Tara", "Anika", "Meera", "Zara", "Vanya",
  "Pooja", "Neha", "Sneha", "Priya", "Kavita", "Sunita", "Anita", "Deepa", "Rekha", "Shweta",
  "Ritu", "Kriti", "Disha", "Tanvi", "Simran", "Ishita", "Divya", "Aishwarya", "Swati", "Megha",
  "Pallavi", "Rupal", "Kajal", "Juhi", "Bhavna", "Archana", "Garima", "Geeta", "Jyoti", "Lata",
  "Mamta", "Nisha", "Payal", "Radha", "Rashmi", "Sangeeta", "Shikha", "Usha", "Vidya", "Yamini"
];

const middleNamesOrInitials = [
  "Kumar", "Chandra", "Prasad", "Singh", "Nath", "Lal", "Kant", "Deo", "Babu", "Ram",
  "K.", "S.", "R.", "M.", "V.", "P.", "A.", "D.", "J.", "N."
];

const lastNames = [
  "Sharma", "Patel", "Verma", "Rao", "Mehta", "Singh", "Kumar", "Gupta", "Joshi", "Bhatia",
  "Malhotra", "Kapoor", "Chopra", "Reddy", "Nair", "Pillai", "Iyer", "Menon", "Mukherjee", "Chatterjee",
  "Banerjee", "Das", "Dutta", "Roy", "Bose", "Sengupta", "Choudhury", "Mishra", "Pandey", "Trivedi",
  "Deshmukh", "Kulkarni", "Patil", "Pawar", "Shinde", "Jadhav", "Gaekwad", "Chavan", "Bhosale", "More",
  "Agarwal", "Bansal", "Garg", "Goel", "Jindal", "Mittal", "Singhal", "Tayal", "Kansal", "Bindal",
  "Yadav", "Tiwari", "Dubey", "Shukla", "Tripathi", "Pathak", "Chaubey", "Upadhyay", "Awasthi", "Pandit",
  "Rathore", "Chauhan", "Tomar", "Rawat", "Negi", "Bhatt", "Bisht", "Thakur", "Kashyap", "Saxena",
  "Srivastava", "Gautam", "Kohli", "Dhoni", "Tendulkar", "Ganguly", "Dravid", "Sehwag", "Gambhir", "Raina",
  "Yuvraj", "Rohit", "Ashwin", "Jadeja", "Bumrah", "Shami", "Siraj", "Gill", "Jaiswal", "Pant"
];

/**
 * Generate a realistic Indian identity with unique @gmail.com email
 */
function generateRealisticIdentity(index, usedEmails, usedUsernames) {
  const fn = firstNames[index % firstNames.length];
  const ln = lastNames[(index * 7 + 13) % lastNames.length];
  const useMid = (index % 5 === 0);
  const mid = useMid ? ` ${middleNamesOrInitials[(index * 3) % middleNamesOrInitials.length]}` : '';
  const fullName = `${fn}${mid} ${ln}`;

  const cleanFn = fn.toLowerCase().replace(/[^a-z]/g, '');
  const cleanLn = ln.toLowerCase().replace(/[^a-z]/g, '');

  const birthYear = 1982 + (index % 23); // 1982 to 2004
  const num2Digits = String(index % 100).padStart(2, '0');
  const num3Digits = String((index * 13) % 900 + 100);

  // Diverse realistic @gmail.com patterns
  const emailTemplates = [
    `${cleanFn}.${cleanLn}${birthYear}@gmail.com`,
    `${cleanFn}.${cleanLn}${num2Digits}@gmail.com`,
    `${cleanFn}${cleanLn}${num3Digits}@gmail.com`,
    `${cleanFn}_${cleanLn}${birthYear % 100}@gmail.com`,
    `${cleanFn}.${cleanLn}@gmail.com`,
    `${cleanFn}${num3Digits}@gmail.com`,
    `${cleanFn}.${cleanLn}.cricket@gmail.com`,
    `${cleanFn}.${cleanLn}.xi@gmail.com`,
    `${cleanFn}${cleanLn}_official@gmail.com`,
    `${cleanFn}.${cleanLn}${index}@gmail.com`
  ];

  let email = '';
  for (const t of emailTemplates) {
    if (!usedEmails.has(t)) {
      email = t;
      break;
    }
  }
  if (!email || usedEmails.has(email)) {
    email = `${cleanFn}.${cleanLn}.${index}@gmail.com`;
  }
  usedEmails.add(email);

  // Diverse realistic usernames
  const usernameTemplates = [
    `${cleanFn}_${cleanLn}${num2Digits}`,
    `${cleanFn}.${cleanLn}${birthYear % 100}`,
    `${cleanFn}_${num3Digits}`,
    `${cleanFn}${cleanLn.slice(0, 3)}_${num2Digits}`,
    `${cleanFn}_xi_${num2Digits}`,
    `${cleanFn}_cricket_${num2Digits}`,
    `${cleanFn}${num3Digits}`
  ];

  let username = '';
  for (const u of usernameTemplates) {
    const cleanU = u.slice(0, 24);
    if (!usedUsernames.has(cleanU)) {
      username = cleanU;
      break;
    }
  }
  if (!username || usedUsernames.has(username)) {
    username = `${cleanFn}_${cleanLn}_${index}`.slice(0, 24);
  }
  usedUsernames.add(username);

  const cleanPrefix = fn.slice(0, 3).toUpperCase();
  const refCode = `P${cleanPrefix}${String(index).padStart(5, '0')}`;

  return { fullName, email, username, refCode };
}

/**
 * Seed Prime Dreems Autonomous Bots up to targetCount (Default: 10,000 Bots)
 * Guarantees realistic Indian names, @gmail.com emails, and ₹1,00,000 wallets.
 */
async function seedBots(targetCount = 10000) {
  const currentCount = await User.count({ where: { is_bot: true } });
  console.log(`🤖 Current bot count in Prime Dreems: ${currentCount}`);

  if (currentCount >= targetCount) {
    console.log(`✅ Already have ${currentCount} bots (>= ${targetCount}). Verified.`);
    return currentCount;
  }

  // Fast Bulk Load from committed seed file if starting from scratch
  const seedFilePath = path.join(__dirname, '../db/seeds/bots-10000.json');
  if (currentCount === 0 && fs.existsSync(seedFilePath)) {
    try {
      console.log(`📂 Loading pre-built 10,000 bots from "${seedFilePath}"...`);
      const fileContent = fs.readFileSync(seedFilePath, 'utf8');
      const jsonBots = JSON.parse(fileContent);

      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

      const BATCH_SIZE = 500;
      for (let i = 0; i < jsonBots.length; i += BATCH_SIZE) {
        const chunk = jsonBots.slice(i, i + BATCH_SIZE);
        const usersToInsert = chunk.map(b => ({
          id: b.id || uuidv4(),
          name: b.name,
          username: b.username,
          role: 'user',
          is_bot: true,
          email: b.email,
          password_hash: 'dummy_hash',
          otp_verified: true,
          kyc_status: 'verified',
          referral_code: b.referral_code,
          subscription_active_until: oneYearFromNow,
          subscription_type: 'system_unlimited',
          referral_round: 1,
          referrals_in_current_round: 0,
          total_referrals_count: 0,
        }));

        const walletsToInsert = chunk.map(b => ({
          id: uuidv4(),
          user_id: b.id,
          balance: 100000.00,
          deposit_balance: 100000.00,
          winnings_balance: 0.00,
          bonus_balance: 0.00,
        }));

        await User.bulkCreate(usersToInsert);
        await Wallet.bulkCreate(walletsToInsert);
        console.log(`📦 Loaded bot chunk: ${Math.min(i + BATCH_SIZE, jsonBots.length)} / ${jsonBots.length}`);
      }

      const finalCount = await User.count({ where: { is_bot: true } });
      console.log(`🎉 10,000 Bots Loaded from seed file! Total bots: ${finalCount}`);
      return finalCount;
    } catch (err) {
      console.warn('Seed file load failed, falling back to dynamic generator:', err.message);
    }
  }

  const needed = targetCount - currentCount;
  console.log(`🚀 Seeding ${needed} realistic Indian bots with @gmail.com for Prime Dreems (Target: ${targetCount})...`);

  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  // Fetch existing emails to prevent collisions
  const existingUsers = await User.findAll({ attributes: ['email', 'username'], raw: true });
  const usedEmails = new Set(existingUsers.map(u => u.email.toLowerCase()));
  const usedUsernames = new Set(existingUsers.map(u => (u.username || '').toLowerCase()));

  const BATCH_SIZE = 500;
  let batchUsers = [];
  let batchWallets = [];
  let totalCreated = 0;

  for (let i = currentCount + 1; i <= targetCount; i++) {
    const identity = generateRealisticIdentity(i, usedEmails, usedUsernames);
    const userId = uuidv4();

    batchUsers.push({
      id: userId,
      name: identity.fullName,
      username: identity.username,
      role: 'user',
      is_bot: true,
      email: identity.email,
      password_hash: 'dummy_hash',
      otp_verified: true,
      kyc_status: 'verified',
      referral_code: identity.refCode,
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
  console.log(`🎉 10,000 Bots Seeding Complete! Total registered bots: ${finalCount}`);
  return finalCount;
}

/**
 * Migration & Refresh: Updates existing bots in database to realistic Indian names and @gmail.com emails
 */
async function updateExistingBotsToRealistic() {
  console.log('🔄 Checking existing bots for realistic names and @gmail.com emails...');
  const bots = await User.findAll({
    where: { is_bot: true },
    order: [['created_at', 'ASC']],
    attributes: ['id', 'name', 'username', 'email', 'referral_code']
  });

  if (bots.length === 0) {
    console.log('No bots found to update.');
    return;
  }

  console.log(`Found ${bots.length} bots. Updating to realistic Indian identities & @gmail.com addresses...`);

  const usedEmails = new Set();
  const usedUsernames = new Set();

  const BATCH_SIZE = 500;
  for (let i = 0; i < bots.length; i += BATCH_SIZE) {
    const chunk = bots.slice(i, i + BATCH_SIZE);
    await Promise.all(chunk.map((bot, idx) => {
      const overallIndex = i + idx + 1;
      const identity = generateRealisticIdentity(overallIndex, usedEmails, usedUsernames);
      return bot.update({
        name: identity.fullName,
        username: identity.username,
        email: identity.email,
        referral_code: identity.refCode,
        kyc_status: 'verified'
      });
    }));
    console.log(`✅ Updated bots batch ${Math.min(i + BATCH_SIZE, bots.length)} / ${bots.length}`);
  }

  // Ensure every bot has an active wallet with ₹1,00,000 balance
  const botIds = bots.map(b => b.id);
  const existingWallets = await Wallet.findAll({
    where: { user_id: botIds },
    attributes: ['user_id']
  });
  const existingWalletUserIds = new Set(existingWallets.map(w => w.user_id));
  const missingWallets = [];

  for (const bot of bots) {
    if (!existingWalletUserIds.has(bot.id)) {
      missingWallets.push({
        id: uuidv4(),
        user_id: bot.id,
        balance: 100000.00,
        deposit_balance: 100000.00,
        winnings_balance: 0.00,
        bonus_balance: 0.00
      });
    }
  }

  if (missingWallets.length > 0) {
    for (let i = 0; i < missingWallets.length; i += BATCH_SIZE) {
      await Wallet.bulkCreate(missingWallets.slice(i, i + BATCH_SIZE));
    }
    console.log(`💰 Created ${missingWallets.length} missing wallets for bots.`);
  }

  console.log(`🌟 All ${bots.length} bots successfully updated with realistic Indian identities & @gmail.com emails!`);
}

module.exports = {
  seedBots,
  updateExistingBotsToRealistic,
  generateRealisticIdentity
};
