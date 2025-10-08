'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Users, Twitter, MessageCircle, Download, ArrowRight, TrendingUp } from 'lucide-react';
import { useAccount } from 'wagmi';
import * as XLSX from 'xlsx';

interface ReferredUser {
  address: string;
  sourceType: string;
  joinedAt: string;
  referralId: string;
}

interface Referral {
  address: string;
  referralCode: string | null;
  twitterId: string | null;
  twitterUserId: string | null;
  telegramUsername: string | null;
  telegramId: string | null;
  totalReferrals: number;
  twitterReferrals: number;
  telegramReferrals: number;
  createdAt: string;
  updatedAt: string;
  referredUsers: ReferredUser[];
}

interface Stats {
  totalUsers: number;
  totalReferrers: number;
  totalReferrals: number;
  twitterReferrals: number;
  telegramReferrals: number;
  averageReferralsPerUser: string;
}

export default function AdminDashboard() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'twitter' | 'telegram'>('all');
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'detailed'>('overview');

  const { address, isConnected } = useAccount();

  const fetchReferrals = useCallback(async () => {
    if (!isConnected || !address) {
      setError('Please connect your wallet to view the admin dashboard.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/dashboard', {
        headers: { 'x-wallet-address': address },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch data');
      }

      const result = await response.json();
      setReferrals(result.data || []);
      setStats(result.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [address, isConnected]);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  // Flatten all referrals into a detailed list
  const detailedReferralList = referrals.flatMap((ref) =>
    ref.referredUsers.map((user) => ({
      referrerAddress: ref.address,
      referrerCode: ref.referralCode,
      referrerTwitter: ref.twitterId,
      referrerTwitterUserId: ref.twitterUserId,
      referrerTelegram: ref.telegramUsername,
      referrerTelegramId: ref.telegramId,
      referredAddress: user.address,
      sourceType: user.sourceType,
      joinedAt: user.joinedAt,
      referralId: user.referralId,
    }))
  );

  const filteredDetailedList = detailedReferralList.filter((item) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      item.referrerAddress.toLowerCase().includes(term) ||
      item.referredAddress.toLowerCase().includes(term) ||
      item.referrerCode?.toLowerCase().includes(term);

    if (filterType === 'twitter') return matchesSearch && item.sourceType === 'twitter';
    if (filterType === 'telegram') return matchesSearch && item.sourceType === 'telegram';
    return matchesSearch;
  });

  const filteredReferrals = referrals.filter((ref) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      ref.address.toLowerCase().includes(term) ||
      ref.referralCode?.toLowerCase().includes(term) ||
      ref.twitterId?.toLowerCase().includes(term) ||
      ref.telegramUsername?.toLowerCase().includes(term);

    if (filterType === 'twitter') return matchesSearch && ref.twitterReferrals > 0;
    if (filterType === 'telegram') return matchesSearch && ref.telegramReferrals > 0;
    return matchesSearch;
  });

  const displayStats = {
    totalUsers: stats?.totalUsers || 0,
    totalReferrals: stats?.totalReferrals || 0,
    twitterReferrals: stats?.twitterReferrals || 0,
    telegramReferrals: stats?.telegramReferrals || 0,
  };

  // XLSX Download Functions
  const downloadOverviewXLSX = () => {
    const worksheetData = filteredReferrals.map(ref => ({
      'Address': ref.address,
      'Referral Code': ref.referralCode || '',
      'Twitter ID': ref.twitterId || '',
      'Twitter User ID': ref.twitterUserId || '',
      'Telegram Username': ref.telegramUsername || '',
      'Telegram ID': ref.telegramId || '',
      'Total Referrals': ref.totalReferrals,
      'Twitter Referrals': ref.twitterReferrals,
      'Telegram Referrals': ref.telegramReferrals,
      'Created At': new Date(ref.createdAt).toLocaleString(),
      'Last Updated': new Date(ref.updatedAt).toLocaleString()
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Referrals Overview');

    // Add summary statistics sheet
    const statsData = [
      { Metric: 'Total Users', Value: stats?.totalUsers || 0 },
      { Metric: 'Total Referrers', Value: stats?.totalReferrers || 0 },
      { Metric: 'Total Referrals', Value: stats?.totalReferrals || 0 },
      { Metric: 'Twitter Referrals', Value: stats?.twitterReferrals || 0 },
      { Metric: 'Telegram Referrals', Value: stats?.telegramReferrals || 0 },
      { Metric: 'Average Referrals Per User', Value: stats?.averageReferralsPerUser || 0 }
    ];
    const statsSheet = XLSX.utils.json_to_sheet(statsData);
    XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistics');

    XLSX.writeFile(workbook, `referrals-overview-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadDetailedXLSX = () => {
    const worksheetData = filteredDetailedList.map(item => ({
      'Referrer Address': item.referrerAddress,
      'Referral Code': item.referrerCode || '',
      'Referrer Twitter': item.referrerTwitter || '',
      'Referrer Twitter User ID': item.referrerTwitterUserId || '',
      'Referrer Telegram': item.referrerTelegram || '',
      'Referrer Telegram ID': item.referrerTelegramId || '',
      'Referred Address': item.referredAddress,
      'Source Type': item.sourceType,
      'Joined At': new Date(item.joinedAt).toLocaleString(),
      'Referral ID': item.referralId
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Detailed Referrals');

    // Add summary by source type
    const twitterCount = filteredDetailedList.filter(r => r.sourceType === 'twitter').length;
    const telegramCount = filteredDetailedList.filter(r => r.sourceType === 'telegram').length;
    
    const summaryData = [
      { 'Source Type': 'Twitter', 'Count': twitterCount },
      { 'Source Type': 'Telegram', 'Count': telegramCount },
      { 'Source Type': 'Total', 'Count': filteredDetailedList.length }
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    XLSX.writeFile(workbook, `referrals-detailed-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // if (loading) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
  //       <div className="text-center">
  //         <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mb-4"></div>
  //         <p className="text-white text-xl">Loading dashboard...</p>
  //       </div>
  //     </div>
  //   );
  // }

  // if (error) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
  //       <div className="bg-red-500/10 border border-red-500 rounded-lg p-6 text-red-200 max-w-md text-center">
  //         <h2 className="text-xl font-bold mb-2">Error</h2>
  //         <p>{error}</p>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-white">Referral Dashboard</h1>
          {stats && (
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-lg rounded-lg px-4 py-2 border border-white/20">
              <TrendingUp className="text-green-400" size={20} />
              <span className="text-white text-sm">
                Avg: <span className="font-bold">{stats.averageReferralsPerUser}</span> referrals/user
              </span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Users', value: displayStats.totalUsers, icon: Users, color: 'text-blue-400' },
            { label: 'Total Referrals', value: displayStats.totalReferrals, icon: Users, color: 'text-green-400' },
            { label: 'Twitter Referrals', value: displayStats.twitterReferrals, icon: Twitter, color: 'text-sky-400' },
            { label: 'Telegram Referrals', value: displayStats.telegramReferrals, icon: MessageCircle, color: 'text-blue-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-300">{label}</p>
                  <p className="text-3xl font-bold text-white">{value}</p>
                </div>
                <Icon className={color} size={32} />
              </div>
            </div>
          ))}
        </div>

        {/* View Mode Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setViewMode('overview')}
            className={`px-6 py-3 rounded-lg font-medium transition ${
              viewMode === 'overview'
                ? 'bg-purple-600 text-white'
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            Overview ({filteredReferrals.length})
          </button>
          <button
            onClick={() => setViewMode('detailed')}
            className={`px-6 py-3 rounded-lg font-medium transition ${
              viewMode === 'detailed'
                ? 'bg-purple-600 text-white'
                : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            Detailed Referrals ({filteredDetailedList.length})
          </button>
        </div>

        {/* Search & Filter */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by address, code, or username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {['all', 'twitter', 'telegram'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type as 'all' | 'twitter' | 'telegram')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    filterType === type
                      ? type === 'twitter'
                        ? 'bg-sky-600 text-white'
                        : type === 'telegram'
                        ? 'bg-blue-600 text-white'
                        : 'bg-purple-600 text-white'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
              <button
                onClick={viewMode === 'overview' ? downloadOverviewXLSX : downloadDetailedXLSX}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
              >
                <Download size={18} />
                Download Excel
              </button>
            </div>
          </div>
        </div>

        {/* Overview Table */}
        {viewMode === 'overview' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    {[
                      'Address',
                      'Referral Code',
                      'Twitter',
                      'Telegram',
                      'Total',
                      <Twitter key="t" size={16} className="inline" />,
                      <MessageCircle key="m" size={16} className="inline" />,
                      'Actions',
                    ].map((header, i) => (
                      <th key={i} className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredReferrals.map((ref, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition">
                      <td className="px-6 py-4 text-sm text-white font-mono">
                        {ref.address.slice(0, 6)}...{ref.address.slice(-4)}
                      </td>
                      <td className="px-6 py-4 text-sm text-purple-300 font-mono">{ref.referralCode || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{ref.twitterId || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{ref.telegramUsername || '-'}</td>
                      <td className="px-6 py-4 text-sm text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-500/20 text-green-300 font-semibold">
                          {ref.totalReferrals}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 font-semibold">
                          {ref.twitterReferrals}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 font-semibold">
                          {ref.telegramReferrals}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => setSelectedReferral(ref)}
                          className="text-purple-400 hover:text-purple-300 font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredReferrals.length === 0 && (
              <div className="text-center py-12 text-gray-400">No referrals found</div>
            )}
          </div>
        )}

        {/* Detailed Referrals Table */}
        {viewMode === 'detailed' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    {[
                      'Referrer',
                      'Code',
                      'Referrer Social',
                      '',
                      'Referred User',
                      'Source',
                      'Joined Date',
                    ].map((header, i) => (
                      <th key={i} className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredDetailedList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition">
                      <td className="px-6 py-4 text-sm text-white font-mono">
                        {item.referrerAddress.slice(0, 6)}...{item.referrerAddress.slice(-4)}
                      </td>
                      <td className="px-6 py-4 text-sm text-purple-300 font-mono">
                        {item.referrerCode || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        <div className="flex flex-col gap-1">
                          {item.referrerTwitter && (
                            <span className="flex items-center gap-1 text-sky-400">
                              <Twitter size={12} />
                              {item.referrerTwitter}
                            </span>
                          )}
                          {item.referrerTelegram && (
                            <span className="flex items-center gap-1 text-blue-400">
                              <MessageCircle size={12} />
                              {item.referrerTelegram}
                            </span>
                          )}
                          {!item.referrerTwitter && !item.referrerTelegram && '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <ArrowRight className="text-purple-400" size={20} />
                      </td>
                      <td className="px-6 py-4 text-sm text-white font-mono">
                        {item.referredAddress.slice(0, 6)}...{item.referredAddress.slice(-4)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {item.sourceType === 'twitter' && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-sky-500/20 text-sky-300 rounded-full text-xs font-semibold">
                            <Twitter size={12} />
                            Twitter
                          </span>
                        )}
                        {item.sourceType === 'telegram' && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-semibold">
                            <MessageCircle size={12} />
                            Telegram
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {new Date(item.joinedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredDetailedList.length === 0 && (
              <div className="text-center py-12 text-gray-400">No detailed referrals found</div>
            )}
          </div>
        )}

        {/* Referral Details Modal */}
        {selectedReferral && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-white/20">
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Referral Details</h2>
                <button onClick={() => setSelectedReferral(null)} className="text-gray-400 hover:text-white text-2xl">
                  ✕
                </button>
              </div>

              <div className="p-6">
                <div className="space-y-4 mb-6">
                  <div>
                    <p className="text-gray-400 text-sm">Address</p>
                    <p className="text-white font-mono">{selectedReferral.address}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Referral Code</p>
                    <p className="text-white font-mono">{selectedReferral.referralCode}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedReferral.twitterId && (
                      <div>
                        <p className="text-gray-400 text-sm">Twitter</p>
                        <p className="text-white">{selectedReferral.twitterId}</p>
                      </div>
                    )}
                    {selectedReferral.telegramUsername && (
                      <div>
                        <p className="text-gray-400 text-sm">Telegram</p>
                        <p className="text-white">{selectedReferral.telegramUsername}</p>
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="text-xl font-bold text-white mb-4">
                  Referred Users ({selectedReferral.referredUsers.length})
                </h3>

                <div className="space-y-2">
                  {selectedReferral.referredUsers.map((user, idx) => (
                    <div key={idx} className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-mono text-sm">
                          {user.address.slice(0, 6)}...{user.address.slice(-4)}
                        </span>
                        <div className="flex items-center gap-2">
                          {user.sourceType === 'twitter' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-sky-500/20 text-sky-300 rounded text-xs">
                              <Twitter size={12} />
                              Twitter
                            </span>
                          )}
                          {user.sourceType === 'telegram' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                              <MessageCircle size={12} />
                              Telegram
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-400 text-xs mt-2">
                        Joined: {new Date(user.joinedAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>

                {selectedReferral.referredUsers.length === 0 && (
                  <p className="text-gray-400 text-center py-8">No referred users yet</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}