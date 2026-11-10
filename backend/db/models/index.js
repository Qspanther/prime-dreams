const SystemSetting = require('./SystemSetting');
const User = require('./User');
const Wallet = require('./Wallet');
const Transaction = require('./Transaction');
const Notification = require('./Notification');
const ReferralLog = require('./ReferralLog');
const ShareLog = require('./ShareLog');
const PushSubscription = require('./PushSubscription');

// ─── Cricket Models ───
const CricketMatch = require('./CricketMatch');
const CricketPlayer = require('./CricketPlayer');
const MatchContest = require('./MatchContest');
const CricketTeam = require('./CricketTeam');
const TeamPlayer = require('./TeamPlayer');
const H2HChallenge = require('./H2HChallenge');
const ScoreAuditLog = require('./ScoreAuditLog');
const PlayerPointsLog = require('./PlayerPointsLog');
const UserReward = require('./UserReward');
const GuruTeam = require('./GuruTeam');

// ─── Associations ───

// User <-> Wallet (1:1)
User.hasOne(Wallet, { foreignKey: 'user_id', as: 'wallet' });
Wallet.belongsTo(User, { foreignKey: 'user_id' });

// Wallet <-> Transaction (1:N)
Wallet.hasMany(Transaction, { foreignKey: 'wallet_id', as: 'transactions' });
Transaction.belongsTo(Wallet, { foreignKey: 'wallet_id' });

// User <-> ShareLog (1:N)
User.hasMany(ShareLog, { foreignKey: 'user_id', as: 'shareLogs' });
ShareLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User <-> Notification (1:N)
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id' });

// CricketMatch <-> CricketPlayer (1:N)
CricketMatch.hasMany(CricketPlayer, { foreignKey: 'match_id', as: 'players' });
CricketPlayer.belongsTo(CricketMatch, { foreignKey: 'match_id', as: 'match' });

// CricketMatch <-> MatchContest (1:N)
CricketMatch.hasMany(MatchContest, { foreignKey: 'match_id', as: 'contests' });
MatchContest.belongsTo(CricketMatch, { foreignKey: 'match_id', as: 'match' });

// CricketMatch <-> CricketTeam (1:N)
CricketMatch.hasMany(CricketTeam, { foreignKey: 'match_id', as: 'teams' });
CricketTeam.belongsTo(CricketMatch, { foreignKey: 'match_id', as: 'match' });

// User <-> CricketTeam (1:N)
User.hasMany(CricketTeam, { foreignKey: 'user_id', as: 'cricketTeams' });
CricketTeam.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// MatchContest <-> CricketTeam (1:N)
MatchContest.hasMany(CricketTeam, { foreignKey: 'contest_id', as: 'teams' });
CricketTeam.belongsTo(MatchContest, { foreignKey: 'contest_id', as: 'contest' });

// CricketTeam <-> TeamPlayer (1:N)
CricketTeam.hasMany(TeamPlayer, { foreignKey: 'team_id', as: 'teamPlayers' });
TeamPlayer.belongsTo(CricketTeam, { foreignKey: 'team_id', as: 'team' });

// CricketPlayer <-> TeamPlayer (1:N)
CricketPlayer.hasMany(TeamPlayer, { foreignKey: 'player_id', as: 'appearances' });
TeamPlayer.belongsTo(CricketPlayer, { foreignKey: 'player_id', as: 'player' });

// CricketTeam <-> CricketPlayer (M:N through TeamPlayer)
CricketTeam.belongsToMany(CricketPlayer, { through: TeamPlayer, foreignKey: 'team_id', otherKey: 'player_id', as: 'players' });
CricketPlayer.belongsToMany(CricketTeam, { through: TeamPlayer, foreignKey: 'player_id', otherKey: 'team_id', as: 'teams' });

// CricketTeam Captain & Vice-Captain
CricketTeam.belongsTo(CricketPlayer, { foreignKey: 'captain_id', as: 'captain' });
CricketTeam.belongsTo(CricketPlayer, { foreignKey: 'vice_captain_id', as: 'viceCaptain' });

// CricketMatch <-> H2HChallenge (1:N)
CricketMatch.hasMany(H2HChallenge, { foreignKey: 'match_id', as: 'challenges' });
H2HChallenge.belongsTo(CricketMatch, { foreignKey: 'match_id', as: 'match' });

// MatchContest <-> H2HChallenge (1:1)
MatchContest.hasOne(H2HChallenge, { foreignKey: 'contest_id', as: 'challenge' });
H2HChallenge.belongsTo(MatchContest, { foreignKey: 'contest_id', as: 'contest' });

// User <-> H2HChallenge (sender & receiver)
User.hasMany(H2HChallenge, { foreignKey: 'sender_id', as: 'sentChallenges' });
User.hasMany(H2HChallenge, { foreignKey: 'receiver_id', as: 'receivedChallenges' });
H2HChallenge.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });
H2HChallenge.belongsTo(User, { foreignKey: 'receiver_id', as: 'receiver' });

module.exports = {
  SystemSetting,
  User,
  Wallet,
  Transaction,
  Notification,
  ReferralLog,
  ShareLog,
  PushSubscription,
  CricketMatch,
  CricketPlayer,
  MatchContest,
  CricketTeam,
  TeamPlayer,
  H2HChallenge,
  ScoreAuditLog,
  PlayerPointsLog,
  UserReward,
  GuruTeam,
};
