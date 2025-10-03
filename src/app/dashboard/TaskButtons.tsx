"use client";

import { useProgress } from "@/hooks/useProgress";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";

// ===== BUTTON COMPONENT =====
function Btn({ 
  state, 
  onClick, 
  children, 
  loading = false 
}: { 
  state: number; 
  onClick?: () => void; 
  children: React.ReactNode;
  loading?: boolean;
}) {
  const disabled = state === 0;
  const completed = state === 3;
  const authenticated = state === 2;
  const initial = state === 1;

  return (
    <button
      disabled={disabled || loading}
      onClick={onClick}
      className={`rounded-2xl p-6 text-xl font-semibold transition-colors relative ${
        completed
          ? "bg-green-700 text-white"
          : authenticated
          ? "bg-yellow-600 text-white"
          : initial
          ? "btn-primary"
          : disabled
          ? "bg-[#101214] opacity-50 cursor-not-allowed text-gray-400"
          : "bg-[#1f2326] hover:bg-[#262a2d] text-white"
      }`}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 rounded-2xl">
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      {children}
    </button>
  );
}

// ===== TWITTER FOLLOW MODAL =====
function TwitterFollowModal({ 
  isOpen, 
  onClose, 
  onFollowed, 
  profileUrl, 
  targetUsername
}: {
  isOpen: boolean;
  onClose: () => void;
  onFollowed: () => void;
  profileUrl?: string;
  targetUsername?: string;
}) {
  const [isFollowing, setIsFollowing] = useState(false);

  const handleOpenProfile = () => {
    if (profileUrl) {
      window.open(profileUrl, '_blank', 'noopener,noreferrer');
      
      toast.success(`Profile opened! Follow @${targetUsername} and come back to verify.`, {
        duration: 5000,
        icon: '👀'
      });
    }
  };

  const handleManualFollow = () => {
    setIsFollowing(true);
    toast.loading('Verifying follow status...', { id: 'manual-check' });
    
    setTimeout(() => {
      toast.dismiss('manual-check');
      onFollowed();
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Follow Required
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Please follow @{targetUsername} on X (Twitter) to unlock Telegram.
          </p>
          
          {profileUrl && (
            <button
              onClick={handleOpenProfile}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
            >
              <span>Open @{targetUsername} Profile</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          )}
          
          <div className="flex space-x-3">
            <button
              onClick={handleManualFollow}
              disabled={isFollowing}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFollowing ? 'Checking...' : 'I Followed Them'}
            </button>
            
            <button
              onClick={onClose}
              className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== MAIN TASK BUTTONS COMPONENT =====
export default function TaskButtons({ disabled }: { disabled?: boolean }) {
  const { address } = useAccount();
  const { data, upsert, refetch } = useProgress();
  const [pending, setPending] = useState<null | "x" | "tg" | "ref">(null);
  const [twitterModal, setTwitterModal] = useState<{
    isOpen: boolean;
    profileUrl?: string;
    targetUsername?: string;
  }>({ isOpen: false });

  const callbackProcessedRef = useRef(false);

  const xState = data?.xState ?? 1;
  const tgState = data?.tgState ?? 0;
  const refState = data?.refState ?? 0;

  // ===== CLEAN URL PARAMETERS =====
  const cleanUrlParams = useCallback(() => {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    
    const twitterParams = [
      'twitter_result',
      'username',
      'target_username',
      'profile_url',
      'toast_message'
    ];
    
    let hasChanges = false;
    twitterParams.forEach(param => {
      if (params.has(param)) {
        params.delete(param);
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      url.search = params.toString();
      window.history.replaceState({}, document.title, url.toString());
    }
  }, []);

  // ===== HANDLE TWITTER CALLBACK RESULTS =====
  useEffect(() => {
    const handleTwitterCallback = async () => {
      if (callbackProcessedRef.current) {
        return;
      }

      const urlParams = new URLSearchParams(window.location.search);
      const twitterResult = urlParams.get('twitter_result');
      
      if (!twitterResult) return;

      callbackProcessedRef.current = true;
      console.log(`🔄 Processing Twitter callback: ${twitterResult}`);

      const username = urlParams.get('username');
      const targetUsername = urlParams.get('target_username');
      const profileUrl = urlParams.get('profile_url');
      const toastMessage = urlParams.get('toast_message');
      
      try {
        // CASE 1: Self-account (target account owner) - Mark as complete and enable Telegram
        if (twitterResult === 'self_account') {
          console.log('🎯 Target account owner detected - marking as complete');
          
          await upsert.mutateAsync({ xState: 3, tgState: 1 });
          await refetch();
          cleanUrlParams();
          
          toast.success(
            toastMessage || `You are the target account owner! Telegram unlocked.`,
            { duration: 5000, icon: '🎯' }
          );
          return;
        }
        
        // CASE 2: Successfully following - Enable Telegram
        if (twitterResult === 'following') {
          console.log('✅ Follow verified - enabling Telegram');
          
          await upsert.mutateAsync({ xState: 3, tgState: 1 });
          await refetch();
          cleanUrlParams();
          
          toast.success(
            toastMessage || `✅ Following @${targetUsername} - Telegram unlocked!`,
            { duration: 5000 }
          );
          return;
        }
        
        // CASE 3: Not following yet - Show modal
        if (twitterResult === 'not_following') {
          console.log('❌ Not following - showing modal');
          
          await upsert.mutateAsync({ xState: 2 });
          await refetch();
          cleanUrlParams();
          
          if (targetUsername && profileUrl) {
            setTwitterModal({
              isOpen: true,
              profileUrl,
              targetUsername
            });
            
            toast.success(
              toastMessage || `Connected as @${username}. Please follow @${targetUsername}.`,
              { duration: 5000, icon: '👋' }
            );
          }
          return;
        }
        
        // CASE 4: Still not following after recheck
        if (twitterResult === 'still_not_following') {
          console.log('❌ Still not following');
          
          await refetch();
          cleanUrlParams();
          
          if (targetUsername && profileUrl) {
            setTwitterModal({
              isOpen: true,
              profileUrl,
              targetUsername
            });
          }
          
          toast.error(
            toastMessage || `Still not following @${targetUsername}. Please follow to continue.`,
            { duration: 6000 }
          );
          return;
        }
        
        // CASE 5: Error
        if (twitterResult === 'error') {
          console.error('❌ Twitter OAuth error');
          cleanUrlParams();
          
          toast.error(
            toastMessage || 'Twitter authentication failed. Please try again.',
            { duration: 6000 }
          );
          return;
        }

        // Unknown result
        console.warn('⚠️ Unknown twitter_result:', twitterResult);
        cleanUrlParams();
        
      } catch (error) {
        console.error('❌ Error processing Twitter callback:', error);
        cleanUrlParams();
        
        toast.error('Failed to process authentication. Please try again.', { duration: 5000 });
      }
    };

    handleTwitterCallback();
  }, [upsert, refetch, cleanUrlParams]);

  // ===== INITIATE TWITTER OAUTH =====
  const handleFollowX = useCallback(async () => {
    if (!address || pending) return;
    
    callbackProcessedRef.current = false;
    setPending("x");
    
    try {
      const res = await fetch(`/api/twitter/auth?address=${address}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      
      if (!res.ok) {
        toast.error("Failed to start X OAuth", { duration: 5000 });
        setPending(null);
        return;
      }
      
      const payload = await res.json();
      
      if (!payload?.ok || !payload?.url) {
        toast.error("Invalid OAuth response", { duration: 5000 });
        setPending(null);
        return;
      }
      
      toast.loading('Redirecting to X (Twitter)...', { duration: 2000 });
      
      setTimeout(() => {
        window.location.assign(payload.url);
      }, 500);
      
    } catch (err) {
      console.error("Twitter auth error:", err);
      toast.error("Failed to start X OAuth", { duration: 5000 });
      setPending(null);
    }
  }, [address, pending]);

  // ===== RECHECK TWITTER FOLLOW STATUS =====
  const handleTwitterRecheck = useCallback(async () => {
    if (!address || pending) return;
    
    callbackProcessedRef.current = false;
    setPending("x");
    
    try {
      toast.loading('Verifying follow status...', { id: 'recheck' });
      
      const res = await fetch(`/api/twitter/auth?address=${address}&recheck=true`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      
      if (!res.ok) {
        toast.error("Failed to verify follow status", { duration: 5000, id: 'recheck' });
        setPending(null);
        return;
      }
      
      const payload = await res.json();
      
      if (!payload?.ok || !payload?.url) {
        toast.error("Invalid OAuth response", { duration: 5000, id: 'recheck' });
        setPending(null);
        return;
      }
      
      toast.dismiss('recheck');
      window.location.assign(payload.url);
      
    } catch (err) {
      console.error("Twitter recheck error:", err);
      toast.error("Failed to verify follow status", { duration: 5000, id: 'recheck' });
      setPending(null);
    }
  }, [address, pending]);

  // ===== MODAL: User clicked "I Followed Them" =====
  const handleModalFollowed = useCallback(() => {
    setTwitterModal(prev => ({ ...prev, isOpen: false }));
    
    setTimeout(() => {
      handleTwitterRecheck();
    }, 500);
  }, [handleTwitterRecheck]);

  // ===== HANDLE TELEGRAM VERIFICATION =====
const handleJoinTG = async () => {
  if (!address || pending) return;
  setPending("tg");
  toast.loading("Opening Telegram...", { id: "telegram" });

  try {
    const res = await fetch("/api/telegram/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });

    if (!res.ok) throw new Error("Failed to get Telegram link");

    const { startUrl } = await res.json();
    window.open(startUrl, "_blank");

    toast.success("Open Telegram bot and click Start to continue.", { id: "telegram" });

    // Poll with manual verification
    const interval = setInterval(async () => {
      const r = await fetch("/api/telegram/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      
      const data = await r.json();
      console.log("Verification status:", data);
      
      if (data.verified && data.tgState === 3) {
        toast.success("Telegram verified ✅");
        clearInterval(interval);
        setPending(null);
        // Refresh the page data
        window.location.reload(); // or use your state management
      }
    }, 2000);

    // Clear interval after 10 minutes
    setTimeout(() => {
      clearInterval(interval);
      if (pending === "tg") {
        toast.error("Verification timeout. Please try again.");
        setPending(null);
      }
    }, 600000); // 10 minutes
  } catch (err) {
    console.error(err);
    toast.error("Failed to open Telegram bot.", { id: "telegram" });
    setPending(null);
  }
};




  // ===== HANDLE REFERRAL GENERATION =====
  const handleGetReferral = async () => {
    if (!address || pending) return;
    setPending("ref");
    
    try {
      toast.loading('Generating referral link...', { id: 'referral' });
      
      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ address }),
      });
      console.log("Referral response:", res);
      
      if (!res.ok) {
        toast.error("Failed to generate referral", { duration: 5000, id: 'referral' });
        setPending(null);
        return;
      }
      
      await upsert.mutateAsync({ refState: 3 });
      toast.success("✅ Referral link generated!", { duration: 5000, id: 'referral' });
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate referral", { duration: 5000, id: 'referral' });
    } finally {
      setPending(null);
    }
  };

  // ===== GET BUTTON TEXT =====
  const getXButtonText = () => {
    if (pending === "x") return "Checking...";
    
    switch (xState) {
      case 0:
        return "Follow Megalith on X (Locked)";
      case 1:
        return "Follow Megalith on X";
      case 2:
        return "Complete X Follow ↻";
      case 3:
        return "✓ Following Megalith on X";
      default:
        return "Follow Megalith on X";
    }
  };

  // ===== GET BUTTON ACTION =====
  const getXButtonAction = () => {
    if (disabled) return undefined;
    
    switch (xState) {
      case 1:
        return handleFollowX;
      case 2:
        return handleTwitterRecheck;
      default:
        return undefined;
    }
  };

  // Calculate actual button states based on prerequisites
  const actualTgState = disabled ? 0 : (xState === 3 ? Math.max(tgState, 1) : 0);
  const actualRefState = disabled ? 0 : (tgState === 3 ? Math.max(refState, 1) : 0);

  return (
    <>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-6 opacity-100">
        <Btn 
          state={disabled ? 0 : xState} 
          onClick={getXButtonAction()}
          loading={pending === "x"}
        >
          {getXButtonText()}
        </Btn>
        
        <Btn 
          state={pending === "tg" ? 0 : actualTgState} 
          onClick={actualTgState === 1 ? handleJoinTG : undefined}
          loading={pending === "tg"}
        >
          {tgState === 3 ? "✓ Joined Telegram" : "Join Telegram"}
        </Btn>
        
        <Btn 
          state={pending === "ref" ? 0 : actualRefState} 
          onClick={actualRefState === 1 ? handleGetReferral : undefined}
          loading={pending === "ref"}
        >
          {refState === 3 ? "✓ Referral Generated" : "Reveal Referral Link"}
        </Btn>
      </div>

      <TwitterFollowModal
        isOpen={twitterModal.isOpen}
        onClose={() => setTwitterModal(prev => ({ ...prev, isOpen: false }))}
        onFollowed={handleModalFollowed}
        profileUrl={twitterModal.profileUrl}
        targetUsername={twitterModal.targetUsername}
      />
    </>
  );
}