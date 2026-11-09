'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth-context';
import { apiGet } from '../../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Mail, Phone, Calendar, Search, X, Wallet, Trophy, Activity, CheckCircle, Clock } from 'lucide-react';

export default function AdminUsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Profile Modal State
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (token) {
      apiGet('/admin/users', token)
        .then(data => setUsers(data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [token]);

  const handleUserClick = async (userId: string) => {
    setSelectedUserId(userId);
    setProfileLoading(true);
    try {
      const data = await apiGet(`/admin/users/${userId}`, token);
      setProfileData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setProfileLoading(false);
    }
  };

  const closeProfile = () => {
    setSelectedUserId(null);
    setProfileData(null);
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div>Loading users...</div>;

  return (
    <div className="max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Shield size={28} className="text-[#2563EB]" />
            <h1 className="text-3xl font-bold">Manage Users</h1>
          </div>
          <p className="text-[#334155]">View all {users.length} registered accounts</p>
        </div>
        
        <div className="relative w-full md:w-96">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-[#CBD5E1] rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-[#2563EB] transition-colors text-[#0F172A] placeholder-[#94A3B8]"
          />
        </div>
      </motion.div>

      <div className="prime-card-3d bg-white overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="p-4 font-semibold text-[#334155]">Name</th>
              <th className="p-4 font-semibold text-[#334155]">Email</th>
              <th className="p-4 font-semibold text-[#334155]">Role</th>
              <th className="p-4 font-semibold text-[#334155]">Joined</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => (
              <tr 
                key={u.id} 
                onClick={() => handleUserClick(u.id)}
                className="border-b border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
              >
                <td className="p-4 font-medium">{u.name}</td>
                <td className="p-4 text-[#334155] flex items-center gap-2">
                  <Mail size={14} />
                  {u.email}
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs ${u.role === 'admin' ? 'bg-[#2563EB]/10 text-[#2563EB] font-bold' : 'bg-[#E2E8F0]'}`}>
                    {u.role.toUpperCase()}
                  </span>
                </td>
                <td className="p-4 text-[#334155]">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} />
                    {new Date(u.createdAt).toLocaleDateString()}
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-[#64748B]">No users found matching "{searchQuery}"</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* User Profile Modal */}
      <AnimatePresence>
        {selectedUserId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white border border-[#2563EB]/30 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[#0F172A]"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#E2E8F0] flex justify-between items-start bg-[#F8FAFC]">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    {profileData?.user?.name || 'Loading...'}
                    {profileData?.user?.role === 'admin' && <span className="text-xs bg-[#2563EB] text-white px-2 py-0.5 rounded uppercase font-bold">Admin</span>}
                  </h2>
                  <p className="text-[#64748B] flex items-center gap-4 mt-2 text-sm">
                    <span className="flex items-center gap-1"><Mail size={14}/> {profileData?.user?.email}</span>
                    <span className="flex items-center gap-1"><Calendar size={14}/> Joined {profileData ? new Date(profileData.user.createdAt).toLocaleDateString() : ''}</span>
                  </p>
                </div>
                <button onClick={closeProfile} className="p-2 hover:bg-[#F1F5F9] rounded-lg transition-colors">
                  <X size={24} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                {profileLoading ? (
                  <div className="flex justify-center py-20">
                    <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : profileData ? (
                  <div className="space-y-8">
                    
                    {/* Top Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-[#F1F5F9] p-5 rounded-xl border border-[#F59E0B]/40 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Wallet size={64}/></div>
                        <p className="text-[#64748B] text-sm mb-1">Wallet Balance</p>
                        <p className="text-3xl font-bold text-[#D97706]">₹{parseFloat(profileData.wallet?.balance || '0').toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                      <div className="bg-[#F1F5F9] p-5 rounded-xl border border-purple-300 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Trophy size={64}/></div>
                        <p className="text-[#64748B] text-sm mb-1">Teams Created</p>
                        <p className="text-3xl font-bold text-purple-600">{profileData.teams?.length || 0}</p>
                      </div>
                      <div className="bg-[#F1F5F9] p-5 rounded-xl border border-[#2563EB]/40 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Shield size={64}/></div>
                        <p className="text-[#64748B] text-sm mb-1">KYC Status</p>
                        <div className="flex items-center gap-2 mt-1">
                          {profileData.user.kyc_status === 'verified' ? (
                            <><CheckCircle size={24} className="text-[#2563EB]" /><span className="text-xl font-bold text-[#2563EB]">Verified</span></>
                          ) : profileData.user.kyc_status === 'pending' ? (
                            <><Clock size={24} className="text-[#D97706]" /><span className="text-xl font-bold text-[#D97706]">Pending</span></>
                          ) : (
                            <><X size={24} className="text-red-500" /><span className="text-xl font-bold text-red-500">Unverified</span></>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Transactions */}
                      <div>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Activity size={18} className="text-[#2563EB]"/> Recent Transactions</h3>
                        <div className="bg-[#F1F5F9] rounded-xl border border-[#CBD5E1] overflow-hidden">
                          {profileData.transactions && profileData.transactions.length > 0 ? (
                            <div className="max-h-[300px] overflow-y-auto">
                              {profileData.transactions.map((tx: any) => (
                                <div key={tx.id} className="p-3 border-b border-[#E2E8F0] flex justify-between items-center hover:bg-[#F8FAFC]">
                                  <div>
                                    <p className="text-sm font-medium capitalize">{tx.type.replace('_', ' ')}</p>
                                    <p className="text-xs text-[#64748B]">{new Date(tx.createdAt).toLocaleString()}</p>
                                  </div>
                                  <p className={`font-bold ${['deposit', 'prize'].includes(tx.type) ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {['deposit', 'prize'].includes(tx.type) ? '+' : '-'}₹{parseFloat(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-8 text-center text-[#64748B]">No transactions found</div>
                          )}
                        </div>
                      </div>

                      {/* Teams */}
                      <div>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Trophy size={18} className="text-purple-600"/> Creator Teams</h3>
                        <div className="bg-[#F1F5F9] rounded-xl border border-[#CBD5E1] overflow-hidden">
                          {profileData.teams && profileData.teams.length > 0 ? (
                            <div className="max-h-[300px] overflow-y-auto">
                              {profileData.teams.map((team: any) => (
                                <div key={team.id} className="p-3 border-b border-[#E2E8F0] hover:bg-[#F8FAFC]">
                                  <div className="flex justify-between items-center mb-1">
                                    <p className="text-sm font-bold text-purple-600">{team.name}</p>
                                    <p className="text-xs font-mono text-[#D97706]">Score: {team.total_score}</p>
                                  </div>
                                  <p className="text-xs text-[#334155]">{team.Tournament?.name}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-8 text-center text-[#64748B]">No teams created yet</div>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="text-center py-20 text-[#64748B]">Failed to load profile data</div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
