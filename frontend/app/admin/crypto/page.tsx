'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth-context';
import { apiGet, apiPost, apiPut } from '../../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, CheckCircle, XCircle, Clock, Copy, Check,
  ExternalLink, Save, RefreshCw, AlertCircle, Building2,
  Smartphone, IndianRupee, User, ShieldCheck, ArrowDownLeft,
  ArrowUpRight, QrCode
} from 'lucide-react';

interface DepositItem {
  id: string;
  amount: string | number;
  network?: string;
  txid?: string;
  wallet_address?: string;
  status: string;
  createdAt: string;
  description: string;
  Wallet?: {
    balance: string | number;
    User?: {
      id: string;
      name: string;
      email: string;
      phone?: string;
    };
  };
}

interface WithdrawalItem {
  id: string;
  amount: string | number;
  network?: string;
  wallet_address?: string;
  status: string;
  createdAt: string;
  description: string;
  Wallet?: {
    balance: string | number;
    User?: {
      id: string;
      name: string;
      email: string;
      phone?: string;
      kyc_status?: string;
      kyc_pan?: string;
    };
  };
}

interface InrSettings {
  inr_upi_id: string;
  inr_upi_name: string;
  inr_bank_name: string;
  inr_account_number: string;
  inr_ifsc: string;
  inr_account_name: string;
}

export default function AdminInrControlPage() {
  const { token } = useAuth();

  // Official Gateway Accounts State
  const [settings, setSettings] = useState<InrSettings>({
    inr_upi_id: 'primedreems@upi',
    inr_upi_name: 'Prime Dreems',
    inr_bank_name: 'HDFC Bank Ltd',
    inr_account_number: '50200084729104',
    inr_ifsc: 'HDFC0000240',
    inr_account_name: 'Prime Dreems Sports Pvt Ltd'
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState(false);

  // Queues
  const [deposits, setDeposits] = useState<DepositItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    if (!token) return;
    try {
      const [inrSettings, dep, withdr] = await Promise.all([
        apiGet('/admin/inr-settings', token).catch(() => ({})),
        apiGet('/admin/deposits/pending', token).catch(() => []),
        apiGet('/admin/withdrawals/pending', token).catch(() => [])
      ]);

      if (inrSettings && typeof inrSettings === 'object') {
        setSettings(prev => ({ ...prev, ...inrSettings }));
      }
      setDeposits(Array.isArray(dep) ? dep : []);
      setWithdrawals(Array.isArray(withdr) ? withdr : []);
    } catch (err) {
      console.error('Fetch admin INR data error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setMsg(null);
    try {
      await apiPut('/admin/inr-settings', settings, token!);
      setSettingsSaveSuccess(true);
      setTimeout(() => setSettingsSaveSuccess(false), 3000);
      setMsg({ type: 'success', text: 'Official INR payment receiving details updated successfully! Changes are live on all player wallets.' });
    } catch (err: unknown) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save INR settings' });
    } finally {
      setSavingSettings(false);
    }
  };

  // 1-Click Approve Deposit
  const handleApproveDeposit = async (id: string, amount: string | number) => {
    setActionLoadingId(id);
    setMsg(null);
    try {
      await apiPost(`/admin/deposits/${id}/approve`, {}, token!);
      setMsg({ type: 'success', text: `Deposit of ₹${parseFloat(amount.toString()).toLocaleString('en-IN')} approved! Player wallet credited.` });
      fetchData();
    } catch (err: unknown) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Approval failed' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Reject Deposit
  const handleRejectDeposit = async (id: string) => {
    const reason = prompt('Enter rejection reason (e.g. UTR not found on bank/UPI statement):') || 'UTR verification failed';
    if (!reason) return;
    setActionLoadingId(id);
    setMsg(null);
    try {
      await apiPost(`/admin/deposits/${id}/reject`, { reason }, token!);
      setMsg({ type: 'success', text: 'Deposit proof marked as rejected.' });
      fetchData();
    } catch (err: unknown) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Rejection failed' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // 1-Click Approve Withdrawal (Payout)
  const handleApproveWithdrawal = async (id: string, amount: string | number) => {
    setActionLoadingId(id);
    setMsg(null);
    try {
      await apiPost(`/admin/withdrawals/${id}/approve`, {}, token!);
      setMsg({ type: 'success', text: `Payout of ₹${Math.abs(parseFloat(amount.toString())).toLocaleString('en-IN')} marked as completed!` });
      fetchData();
    } catch (err: unknown) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Approval failed' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Reject Withdrawal & Refund
  const handleRejectWithdrawal = async (id: string, amount: string | number) => {
    const reason = prompt('Enter rejection reason (e.g. Invalid UPI ID / Incorrect Bank Details):') || 'Invalid destination account details';
    if (!reason) return;
    setActionLoadingId(id);
    setMsg(null);
    try {
      await apiPost(`/admin/withdrawals/${id}/reject`, { reason }, token!);
      setMsg({ type: 'success', text: `Withdrawal rejected and ₹${Math.abs(parseFloat(amount.toString())).toLocaleString('en-IN')} refunded to player wallet.` });
      fetchData();
    } catch (err: unknown) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Rejection failed' });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-500/20">
              ₹
            </div>
            <span>INR Payments & Gateway Control</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#334155] mt-1">
            Configure receiving UPI/Bank accounts, verify 12-digit UTR deposit proofs, and approve player payouts
          </p>
        </div>

        <button
          onClick={fetchData}
          className="self-start sm:self-auto px-4 py-2 rounded-xl bg-white hover:bg-[#F1F5F9] text-emerald-600 border border-emerald-300 text-xs font-bold flex items-center gap-2 cursor-pointer transition-all"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Message Banner */}
      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`p-4 rounded-2xl flex items-center gap-3 border text-xs sm:text-sm font-bold ${
              msg.type === 'success'
                ? 'bg-green-50 border-green-300 text-green-700'
                : 'bg-red-50 border-red-300 text-red-700'
            }`}
          >
            {msg.type === 'success' ? <CheckCircle size={18} className="shrink-0" /> : <AlertCircle size={18} className="shrink-0" />}
            <span>{msg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── SECTION 1: OFFICIAL INR RECEIVING ACCOUNTS (ADMIN CONTROLS) ─── */}
      <div className="prime-card-3d bg-white p-6 sm:p-8 border border-[#CBD5E1]">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E2E8F0]">
          <div>
            <h3 className="text-lg font-black text-[#0F172A] flex items-center gap-2">
              <Smartphone size={20} className="text-emerald-600" />
              <span>Official Platform Receiving Accounts (UPI & Bank)</span>
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Players will pay to this UPI ID & Bank Account when depositing cash on the /wallet page
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block mb-1.5">
                Official UPI ID (VPA)
              </label>
              <input
                type="text"
                value={settings.inr_upi_id}
                onChange={e => setSettings(prev => ({ ...prev, inr_upi_id: e.target.value }))}
                placeholder="primedreems@upi"
                className="w-full !font-mono !text-xs !py-3 !bg-white border border-[#CBD5E1] px-3 focus:outline-none focus:border-[#2563EB] !rounded-xl text-[#0F172A]"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block mb-1.5">
                UPI Merchant / Payee Name
              </label>
              <input
                type="text"
                value={settings.inr_upi_name}
                onChange={e => setSettings(prev => ({ ...prev, inr_upi_name: e.target.value }))}
                placeholder="Prime Dreems"
                className="w-full !text-xs !py-3 !bg-white border border-[#CBD5E1] px-3 focus:outline-none focus:border-[#2563EB] !rounded-xl text-[#0F172A]"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block mb-1.5">
                Corporate Bank Name
              </label>
              <input
                type="text"
                value={settings.inr_bank_name}
                onChange={e => setSettings(prev => ({ ...prev, inr_bank_name: e.target.value }))}
                placeholder="HDFC Bank Ltd"
                className="w-full !text-xs !py-3 !bg-white border border-[#CBD5E1] px-3 focus:outline-none focus:border-[#2563EB] !rounded-xl text-[#0F172A]"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block mb-1.5">
                Corporate Bank Account Number
              </label>
              <input
                type="text"
                value={settings.inr_account_number}
                onChange={e => setSettings(prev => ({ ...prev, inr_account_number: e.target.value }))}
                placeholder="50200084729104"
                className="w-full !font-mono !text-xs !py-3 !bg-white border border-[#CBD5E1] px-3 focus:outline-none focus:border-[#2563EB] !rounded-xl text-[#0F172A]"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block mb-1.5">
                Bank IFSC Code
              </label>
              <input
                type="text"
                value={settings.inr_ifsc}
                onChange={e => setSettings(prev => ({ ...prev, inr_ifsc: e.target.value.toUpperCase() }))}
                placeholder="HDFC0000240"
                className="w-full !font-mono !text-xs !py-3 !bg-white border border-[#CBD5E1] px-3 focus:outline-none focus:border-[#2563EB] !rounded-xl uppercase text-[#0F172A]"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block mb-1.5">
                Account Beneficiary Name
              </label>
              <input
                type="text"
                value={settings.inr_account_name}
                onChange={e => setSettings(prev => ({ ...prev, inr_account_name: e.target.value }))}
                placeholder="Creator Entertainment League Pvt Ltd"
                className="w-full !text-xs !py-3 !bg-white border border-[#CBD5E1] px-3 focus:outline-none focus:border-[#2563EB] !rounded-xl text-[#0F172A]"
                required
              />
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <motion.button
              type="submit"
              disabled={savingSettings}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-6 py-3 rounded-xl font-black text-xs bg-gradient-to-r from-emerald-500 to-teal-600 text-white flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
            >
              {settingsSaveSuccess ? <Check size={16} /> : <Save size={16} />}
              <span>{savingSettings ? 'Saving...' : settingsSaveSuccess ? 'Saved & Live!' : 'Save INR Payment Settings'}</span>
            </motion.button>
          </div>
        </form>
      </div>

      {/* ─── SECTION 2: PENDING INR DEPOSITS QUEUE (UTR VERIFICATION) ─── */}
      <div className="prime-card-3d bg-white p-6 sm:p-8 border border-[#CBD5E1] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <ArrowDownLeft size={22} className="text-emerald-600" />
            <div>
              <h3 className="text-lg font-black text-[#0F172A] flex items-center gap-2">
                Pending INR Deposit Proofs
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300">
                  {deposits.length} Pending
                </span>
              </h3>
              <p className="text-xs text-[#64748B]">
                Match the 12-digit UTR with your bank/UPI statement and click Approve to credit the player
              </p>
            </div>
          </div>
        </div>

        {deposits.length === 0 ? (
          <div className="py-12 text-center text-[#64748B] text-xs">
            <CheckCircle size={32} className="text-emerald-600 mx-auto mb-2 opacity-50" />
            <p className="font-bold text-[#0F172A] text-sm">All deposits verified</p>
            <p className="text-[#64748B] text-xs mt-0.5">New player deposit submissions will appear here in real-time.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deposits.map(d => {
              const userObj = d.Wallet?.User;
              const dateStr = new Date(d.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={d.id}
                  className="p-4 rounded-2xl bg-[#F1F5F9] border border-[#CBD5E1] flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-[#0F172A]">{userObj?.name || 'Player'}</span>
                      <span className="text-xs text-[#64748B]">({userObj?.email || 'No email'})</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="font-mono text-lg font-black text-emerald-600">
                        ₹{parseFloat(d.amount.toString()).toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#E2E8F0] text-[#64748B]">
                        {d.network || 'UPI'}
                      </span>
                      <span className="text-[#64748B] text-[11px] flex items-center gap-1">
                        <Clock size={12} /> {dateStr}
                      </span>
                    </div>

                    {/* UTR / Ref Number with Copy */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] font-bold text-[#64748B]">UTR / Ref:</span>
                      <span className="font-mono text-xs font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                        {d.txid || 'No UTR'}
                      </span>
                      {d.txid && (
                        <button
                          onClick={() => handleCopy(d.txid!, d.id)}
                          className="text-[11px] text-[#64748B] hover:text-[#0F172A] flex items-center gap-1 cursor-pointer"
                        >
                          {copiedId === d.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          <span>{copiedId === d.id ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                      {d.wallet_address && (
                        <span className="text-[11px] text-[#64748B]">
                          • Sender: <strong className="text-[#0F172A]">{d.wallet_address}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Approve / Reject Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <motion.button
                      disabled={actionLoadingId === d.id}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleApproveDeposit(d.id, d.amount)}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle size={15} />
                      <span>{actionLoadingId === d.id ? 'Processing...' : 'Approve & Credit'}</span>
                    </motion.button>

                    <button
                      disabled={actionLoadingId === d.id}
                      onClick={() => handleRejectDeposit(d.id)}
                      className="px-3 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                    >
                      <XCircle size={15} />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── SECTION 3: PENDING INR WITHDRAWALS QUEUE (PAYOUT PROCESSING) ─── */}
      <div className="prime-card-3d bg-white p-6 sm:p-8 border border-[#CBD5E1] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <ArrowUpRight size={22} className="text-[#2563EB]" />
            <div>
              <h3 className="text-lg font-black text-[#0F172A] flex items-center gap-2">
                Pending INR Payout Requests
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-300">
                  {withdrawals.length} Pending
                </span>
              </h3>
              <p className="text-xs text-[#64748B]">
                Transfer the funds to player's destination account via UPI / NetBanking, then mark as paid
              </p>
            </div>
          </div>
        </div>

        {withdrawals.length === 0 ? (
          <div className="py-12 text-center text-[#64748B] text-xs">
            <CheckCircle size={32} className="text-[#2563EB] mx-auto mb-2 opacity-50" />
            <p className="font-bold text-[#0F172A] text-sm">All payouts cleared</p>
            <p className="text-[#64748B] text-xs mt-0.5">Player withdrawal requests will appear here immediately.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {withdrawals.map(w => {
              const userObj = w.Wallet?.User;
              const numAmt = Math.abs(parseFloat(w.amount.toString()));
              const dateStr = new Date(w.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={w.id}
                  className="p-4 rounded-2xl bg-[#F1F5F9] border border-[#CBD5E1] flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-[#0F172A]">{userObj?.name || 'Player'}</span>
                      <span className="text-xs text-[#64748B]">({userObj?.email || 'No email'})</span>
                      {userObj?.kyc_pan && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-300">
                          PAN: {userObj.kyc_pan}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="font-mono text-lg font-black text-[#2563EB]">
                        ₹{numAmt.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#E2E8F0] text-[#64748B]">
                        {w.network || 'UPI'}
                      </span>
                      <span className="text-[#64748B] text-[11px] flex items-center gap-1">
                        <Clock size={12} /> {dateStr}
                      </span>
                      {w.Wallet && (
                        <span className="text-[#64748B] text-[11px]">
                          • Balance: ₹{parseFloat(w.Wallet.balance.toString()).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>

                    {/* Destination Account with Copy */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] font-bold text-[#64748B]">Payout Destination:</span>
                      <span className="font-mono text-xs font-black text-[#0F172A] bg-[#E2E8F0] px-2.5 py-0.5 rounded-md border border-[#CBD5E1]">
                        {w.wallet_address || 'Not specified'}
                      </span>
                      {w.wallet_address && (
                        <button
                          onClick={() => handleCopy(w.wallet_address!, w.id)}
                          className="text-[11px] text-[#64748B] hover:text-[#0F172A] flex items-center gap-1 cursor-pointer"
                        >
                          {copiedId === w.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          <span>{copiedId === w.id ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <motion.button
                      disabled={actionLoadingId === w.id}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleApproveWithdrawal(w.id, w.amount)}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-[#2563EB]/20 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle size={15} />
                      <span>{actionLoadingId === w.id ? 'Processing...' : 'Mark as Paid'}</span>
                    </motion.button>

                    <button
                      disabled={actionLoadingId === w.id}
                      onClick={() => handleRejectWithdrawal(w.id, w.amount)}
                      className="px-3 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                    >
                      <XCircle size={15} />
                      <span>Reject & Refund</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
