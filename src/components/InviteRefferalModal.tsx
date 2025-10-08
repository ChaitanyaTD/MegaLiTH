import React, { useState, ChangeEvent, KeyboardEvent } from 'react';
import { X } from 'lucide-react';

interface ReferralInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRedeem: (code: string) => Promise<void>;
}

export default function ReferralInviteModal({ isOpen, onClose, onRedeem }: ReferralInviteModalProps) {
  const [inviteCode, setInviteCode] = useState<string[]>(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleInputChange = (index: number, value: string) => {
    if (value.length > 1) return;

    const newCode = [...inviteCode];
    newCode[index] = value.toUpperCase();
    setInviteCode(newCode);
    setError('');

    if (value && index < 5) {
      const nextInput = document.getElementById(`code-input-${index + 1}`) as HTMLInputElement | null;
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !inviteCode[index] && index > 0) {
      const prevInput = document.getElementById(`code-input-${index - 1}`) as HTMLInputElement | null;
      if (prevInput) prevInput.focus();
    }
  };

  const handleRedeem = async () => {
    const code = inviteCode.join('');
    if (code.length !== 6) return;

    setIsLoading(true);
    setError('');
    
    try {
      await onRedeem(code);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to redeem code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 rounded-2xl max-w-2xl w-full p-8 relative shadow-2xl border border-zinc-800">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-3 rounded-xl">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">
            Enter your invite code to earn your airdrop
          </h2>
          <p className="text-zinc-400 text-sm">
            Enter the 6-character code to claim your rewards
          </p>
        </div>

        <div className="flex justify-center gap-3 mb-4">
          {inviteCode.map((digit, index) => (
            <input
              key={index}
              id={`code-input-${index}`}
              type="text"
              maxLength={1}
              value={digit}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleInputChange(index, e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => handleKeyDown(index, e)}
              className="w-16 h-16 text-center text-2xl font-bold bg-transparent border-2 border-orange-500 text-white rounded-lg focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50 transition-all"
              placeholder=""
            />
          ))}
        </div>

        {error && (
          <div className="mb-6 text-center text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleRedeem}
          disabled={inviteCode.join('').length !== 6 || isLoading}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-4 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-6 text-lg shadow-lg shadow-orange-500/30"
        >
          {isLoading ? 'Redeeming...' : 'Redeem invite code'}
        </button>

        <div className="text-center">
          <p className="text-zinc-400">
            Don't have an invite code?{' '}
            <button
              onClick={handleSkip}
              className="text-orange-500 hover:text-orange-400 font-medium transition-colors"
            >
              Skip
            </button>
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-zinc-800">
          <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Referral codes are case-insensitive</span>
          </div>
        </div>
      </div>
    </div>
  );
}