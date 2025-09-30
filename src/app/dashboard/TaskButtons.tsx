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
  targetUsername,
  authData 
}: {
  isOpen: boolean;
  onClose: () => void;
  onFollowed: () => void;
  profileUrl?: string;
  targetUsername?: string;
  authData?: Record<string, unknown>;
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

  const handleClose = () => {
    onClose();
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
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Please follow @{targetUsername} on X (Twitter) to continue.
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
              onClick={handleClose}
              className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
          
          {Boolean(authData?.apiError) && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                <strong>Note:</strong> Automatic verification failed ({String(authData?.apiError)}). Please follow manually and click &quot;I Followed Them&quot;.
              </p>
            </div>
          )}
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
    authData?: Record<string, unknown>;
  }>({ isOpen: false });

  const isRecheckingRef = useRef(false);
  const callbackProcessedRef = useRef(false);
  const autoRecheckOnLoadRef = useRef(false);

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
      'error_message',
      'toast_type',
      'toast_message',
      'is_following',
      'needs_follow'
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
      console.log('✅ URL parameters cleaned');
    }
  }, []);

  // ===== AUTO-RECHECK ON PAGE LOAD (if in state 2) =====
  useEffect(() => {
    const performAutoRecheck = async () => {
      // Only auto-recheck once per session when in state 2
      if (xState === 2 && !autoRecheckOnLoadRef.current && !isRecheckingRef.current && address) {
        autoRecheckOnLoadRef.current = true;
        
        console.log('🔄 Auto-checking follow status on page load (state 2)...');
        
        // Show subtle loading toast
        toast.loading('Checking your follow status...', { 
          id: 'auto-load-check',
          duration: 3000 
        });
        
        // Wait a moment for UI to settle
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          isRecheckingRef.current = true;
          
          const res = await fetch(`/api/twitter/auth?address=${address}&recheck=true`, {
            method: "GET",
            headers: { Accept: "application/json" },
          });
          
          if (res.ok) {
            const payload = await res.json();
            
            if (payload?.ok && payload?.url) {
              toast.dismiss('auto-load-check');
              console.log('🔄 Redirecting for auto-recheck...');
              callbackProcessedRef.current = false;
              window.location.assign(payload.url);
              return;
            }
          }
          
          toast.dismiss('auto-load-check');
          console.log('⚠️ Auto-recheck failed, user can manually recheck');
          
        } catch (error) {
          console.error('❌ Auto-recheck error:', error);
          toast.dismiss('auto-load-check');
        } finally {
          isRecheckingRef.current = false;
        }
      }
    };

    // Run after a short delay to ensure data is loaded
    const timer = setTimeout(performAutoRecheck, 500);
    return () => clearTimeout(timer);
  }, [xState, address]);

  // ===== HANDLE TWITTER CALLBACK RESULTS =====
  useEffect(() => {
    const handleTwitterCallback = async () => {
      if (callbackProcessedRef.current) {
        console.log('⚠️ Callback already processed, skipping...');
        return;
      }

      const urlParams = new URLSearchParams(window.location.search);
      const twitterResult = urlParams.get('twitter_result');
      const isFollowing = urlParams.get('is_following') === 'true';
      
      if (!twitterResult) return;

      callbackProcessedRef.current = true;
      console.log(`🔄 Processing Twitter callback: ${twitterResult}, isFollowing: ${isFollowing}`);

      const username = urlParams.get('username');
      const targetUsername = urlParams.get('target_username');
      const profileUrl = urlParams.get('profile_url');
      const toastMessage = urlParams.get('toast_message');
      
      try {
        // ===== CASE 1: Self-follow attempt =====
        if (twitterResult === 'self_follow') {
          console.log('⚠️ Self-follow detected');
          
          await upsert.mutateAsync({ xState: 2 });
          await refetch();
          cleanUrlParams();
          
          toast.error(
            toastMessage || `You cannot follow your own account (@${username}). Please connect with a different Twitter account.`,
            { 
              duration: 8000,
              icon: '🚫',
              id: 'self-follow-error'
            }
          );
          return;
        }
        
        // ===== CASE 2: Successfully following =====
        if ((twitterResult === 'success' || twitterResult === 'recheck_success') && isFollowing) {
          console.log('✅ Follow verification successful - updating to state 3');
          
          await upsert.mutateAsync({ xState: 3, tgState: 1 });
          await refetch();
          await new Promise(resolve => setTimeout(resolve, 300));
          
          cleanUrlParams();
          
          toast.success(
            toastMessage || `✅ Successfully verified! You are following @${targetUsername}.`,
            { 
              duration: 5000,
              id: 'follow-success'
            }
          );
          return;
        }
        
        // ===== CASE 3: Not following - need to follow =====
        if (twitterResult === 'not_following' && !isFollowing) {
          console.log('❌ User is not following yet');
          
          await upsert.mutateAsync({ xState: 2 });
          await refetch();
          cleanUrlParams();
          
          if (targetUsername && profileUrl) {
            // Show modal immediately
            setTwitterModal({
              isOpen: true,
              profileUrl,
              targetUsername,
              authData: { needsFollow: true }
            });
            
            toast.success(
              `Connected as @${username}. Please follow @${targetUsername} to continue.`,
              {
                duration: 6000,
                icon: '👋',
                id: 'not-following-info'
              }
            );
          } else {
            toast.error(
              toastMessage || 'Please follow the required account to continue.',
              {
                duration: 5000,
                id: 'not-following-error'
              }
            );
          }
          return;
        }
        
        // ===== CASE 4: Still not following after recheck =====
        if (twitterResult === 'still_not_following' && !isFollowing) {
          console.log('❌ Still not following after recheck');
          
          await refetch();
          cleanUrlParams();
          
          if (targetUsername) {
            setTwitterModal({
              isOpen: true,
              profileUrl: profileUrl || undefined,
              targetUsername,
              authData: { stillNotFollowing: true }
            });
          }
          
          toast.error(
            toastMessage || `❌ Still not following @${targetUsername}. Please follow and try again.`,
            { 
              duration: 6000,
              id: 'still-not-following'
            }
          );
          return;
        }
        
        // ===== CASE 5: Manual verification needed =====
        if (twitterResult === 'manual_check') {
          console.log('⚠️ Manual verification required');
          
          await upsert.mutateAsync({ xState: 2 });
          await refetch();
          cleanUrlParams();
          
          if (targetUsername) {
            setTwitterModal({
              isOpen: true,
              profileUrl: profileUrl || undefined,
              targetUsername,
              authData: { 
                needsManualCheck: true,
                apiError: "Automatic verification unavailable"
              }
            });
          }
          
          toast(
            toastMessage || `Connected as @${username}. Manual verification required.`,
            { 
              duration: 5000,
              icon: '⚠️',
              id: 'manual-check'
            }
          );
          return;
        }
        
        // ===== CASE 6: Basic authentication =====
        if (twitterResult === 'authenticated') {
          console.log('✅ Authenticated but follow status unclear');
          
          await upsert.mutateAsync({ xState: 2 });
          await refetch();
          cleanUrlParams();
          
          toast(
            toastMessage || `Connected as @${username}. Checking follow status...`,
            { 
              duration: 3000,
              icon: 'ℹ️',
              id: 'authenticated'
            }
          );
          
          // Trigger auto-recheck after authentication
          setTimeout(() => {
            if (!isRecheckingRef.current) {
              handleTwitterRecheckSilent();
            }
          }, 2000);
          return;
        }
        
        // ===== CASE 7: Error handling =====
        if (twitterResult === 'error') {
          console.error('❌ Twitter OAuth error');
          
          cleanUrlParams();
          
          toast.error(
            toastMessage || 'Twitter authentication failed. Please try again.',
            { 
              duration: 6000,
              id: 'twitter-error'
            }
          );
          return;
        }

        // ===== Unknown result =====
        console.warn('⚠️ Unknown twitter_result:', twitterResult);
        cleanUrlParams();
        
      } catch (error) {
        console.error('❌ Error processing Twitter callback:', error);
        cleanUrlParams();
        
        toast.error(
          'Failed to process authentication. Please try again.',
          { 
            duration: 5000,
            id: 'callback-error'
          }
        );
      }
    };

    handleTwitterCallback();
  }, [upsert, refetch, cleanUrlParams]);

  // ===== AUTO-RECHECK ON TAB VISIBILITY =====
  useEffect(() => {
    if (xState !== 2) return;

    const handleVisibilityChange = () => {
      if (!document.hidden && !isRecheckingRef.current) {
        console.log('👁️ Tab became visible (state 2), triggering recheck...');
        
        toast.loading('Checking if you followed...', { 
          id: 'visibility-check',
          duration: 2000 
        });
        
        setTimeout(() => {
          handleTwitterRecheckSilent();
        }, 1500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [xState]);

  // ===== INITIATE TWITTER OAUTH =====
  const handleFollowX = useCallback(async () => {
    if (!address || pending) return;
    
    callbackProcessedRef.current = false;
    autoRecheckOnLoadRef.current = false;
    
    setPending("x");
    try {
      const res = await fetch(`/api/twitter/auth?address=${address}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      
      if (!res.ok) {
        const txt = await res.text().catch(() => "no body");
        console.error("Twitter auth request failed:", res.status, txt);
        
        try {
          const errorData = JSON.parse(txt);
          toast.error(errorData.message || "Failed to start X OAuth", { duration: 5000 });
        } catch {
          toast.error("Failed to start X OAuth", { duration: 5000 });
        }
        setPending(null);
        return;
      }
      
      const payload = await res.json().catch(() => null);
      
      if (!payload?.ok || !payload?.url) {
        console.error("Invalid /api/twitter/auth response:", payload);
        toast.error(payload?.message || "Invalid OAuth response", { duration: 5000 });
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
    if (!address || pending || isRecheckingRef.current) return;
    
    callbackProcessedRef.current = false;
    isRecheckingRef.current = true;
    setPending("x");
    
    try {
      toast.loading('Verifying follow status...', { id: 'recheck' });
      
      const res = await fetch(`/api/twitter/auth?address=${address}&recheck=true`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      
      if (!res.ok) {
        const txt = await res.text().catch(() => "no body");
        console.error("Twitter recheck auth failed:", res.status, txt);
        toast.error("Failed to verify follow status", { duration: 5000, id: 'recheck' });
        setPending(null);
        isRecheckingRef.current = false;
        return;
      }
      
      const payload = await res.json();
      
      if (!payload?.ok || !payload?.url) {
        console.error("Invalid recheck auth response:", payload);
        toast.error(payload?.message || "Invalid OAuth response", { duration: 5000, id: 'recheck' });
        setPending(null);
        isRecheckingRef.current = false;
        return;
      }
      
      toast.dismiss('recheck');
      window.location.assign(payload.url);
      
    } catch (err) {
      console.error("Twitter recheck error:", err);
      toast.error("Failed to verify follow status", { duration: 5000, id: 'recheck' });
      setPending(null);
      isRecheckingRef.current = false;
    }
  }, [address, pending]);

  // ===== SILENT RECHECK =====
  const handleTwitterRecheckSilent = useCallback(async () => {
    if (!address || isRecheckingRef.current) return;
    
    callbackProcessedRef.current = false;
    isRecheckingRef.current = true;
    
    try {
      const res = await fetch(`/api/twitter/auth?address=${address}&recheck=true`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      
      if (!res.ok) {
        console.error("Silent recheck failed:", res.status);
        toast.dismiss('visibility-check');
        toast.dismiss('auto-load-check');
        isRecheckingRef.current = false;
        return;
      }
      
      const payload = await res.json();
      
      if (!payload?.ok || !payload?.url) {
        console.error("Invalid silent recheck response:", payload);
        toast.dismiss('visibility-check');
        toast.dismiss('auto-load-check');
        isRecheckingRef.current = false;
        return;
      }
      
      window.location.assign(payload.url);
      
    } catch (err) {
      console.error("Silent recheck error:", err);
      toast.dismiss('visibility-check');
      toast.dismiss('auto-load-check');
      isRecheckingRef.current = false;
    }
  }, [address]);

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
    
    try {
      toast.loading('Verifying Telegram...', { id: 'telegram' });
      
      const telegramUserId = prompt("Enter your Telegram User ID for verification");
      if (!telegramUserId) {
        toast.dismiss('telegram');
        toast.error("Telegram ID required", { duration: 3000 });
        setPending(null);
        return;
      }
      
      const res = await fetch("/api/telegram/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ address, telegramUserId }),
      });
      
      if (!res.ok) {
        const txt = await res.text().catch(() => "no body");
        console.error("Telegram verify failed:", res.status, txt);
        toast.error("Telegram verification failed", { duration: 5000, id: 'telegram' });
        setPending(null);
        return;
      }
      
      const data = await res.json().catch(() => null);
      
      if (data?.verified) {
        await upsert.mutateAsync({ tgState: 3, refState: 1 });
        toast.success("✅ Telegram verified! Referral link unlocked.", { duration: 5000, id: 'telegram' });
      } else {
        toast.error("Telegram not verified", { duration: 5000, id: 'telegram' });
      }
    } catch (err) {
      console.error(err);
      toast.error("Telegram verification failed", { duration: 5000, id: 'telegram' });
    } finally {
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
      
      if (!res.ok) {
        const txt = await res.text().catch(() => "no body");
        console.error("Referral request failed:", res.status, txt);
        toast.error("Failed to generate referral", { duration: 5000, id: 'referral' });
        setPending(null);
        return;
      }
      
      const referral = await res.json().catch(() => null);
      console.log("Referral generated:", referral);
      
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
          state={disabled || pending === "tg" ? 0 : tgState} 
          onClick={!disabled && tgState === 1 ? handleJoinTG : undefined}
          loading={pending === "tg"}
        >
          {tgState === 3 ? "✓ Joined Telegram" : "Join Telegram"}
        </Btn>
        
        <Btn 
          state={disabled || pending === "ref" ? 0 : refState} 
          onClick={!disabled && refState === 1 ? handleGetReferral : undefined}
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
        authData={twitterModal.authData}
      />
    </>
  );
}