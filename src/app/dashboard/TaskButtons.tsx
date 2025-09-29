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
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(false);
  const [checkCount, setCheckCount] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    const handleAutoCheck = async () => {
      setCheckCount(prev => prev + 1);
      console.log(`🔄 Auto-checking follow status (attempt ${checkCount + 1})...`);
      
      if ((checkCount + 1) % 3 === 0) {
        toast.loading(`Checking follow status... (${checkCount + 1})`, {
          id: 'auto-check',
          duration: 2000
        });
      }
      
      onFollowed();
    };

    if (autoCheckEnabled && isOpen) {
      interval = setInterval(handleAutoCheck, 3000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
        toast.dismiss('auto-check');
      }
    };
  }, [autoCheckEnabled, isOpen, onFollowed, checkCount]);

  const handleOpenProfile = () => {
    if (profileUrl) {
      window.open(profileUrl, '_blank', 'noopener,noreferrer');
      setAutoCheckEnabled(true);
      setCheckCount(0);
      
      toast.success(`Profile opened! Follow @${targetUsername} and we'll detect it automatically.`, {
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
    setAutoCheckEnabled(false);
    setCheckCount(0);
    toast.dismiss('auto-check');
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
          
          {autoCheckEnabled && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-blue-700 dark:text-blue-300 text-sm">
                  Auto-checking... Follow @{targetUsername} and we&apos;ll detect it! ({checkCount} checks)
                </span>
              </div>
            </div>
          )}
          
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
  const { data, upsert } = useProgress();
  const [pending, setPending] = useState<null | "x" | "tg" | "ref">(null);
  const [twitterModal, setTwitterModal] = useState<{
    isOpen: boolean;
    profileUrl?: string;
    targetUsername?: string;
    authData?: Record<string, unknown>;
  }>({ isOpen: false });

  const isRecheckingRef = useRef(false);
  const lastCheckTimeRef = useRef(0);
  const profileOpenedRef = useRef(false);
  const callbackProcessedRef = useRef(false); // Prevent duplicate processing

  const xState = data?.xState ?? 1;
  const tgState = data?.tgState ?? 0;
  const refState = data?.refState ?? 0;

  // ===== CLEAN URL PARAMETERS =====
  const cleanUrlParams = useCallback(() => {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    
    // List of Twitter callback parameters to remove
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

  // ===== HANDLE TWITTER CALLBACK RESULTS =====
  useEffect(() => {
    const handleTwitterCallback = async () => {
      // Prevent duplicate processing
      if (callbackProcessedRef.current) {
        console.log('⚠️ Callback already processed, skipping...');
        return;
      }

      const urlParams = new URLSearchParams(window.location.search);
      const twitterResult = urlParams.get('twitter_result');
      
      if (!twitterResult) return;

      // Mark as processed immediately
      callbackProcessedRef.current = true;
      console.log(`🔄 Processing Twitter callback: ${twitterResult}`);

      const username = urlParams.get('username');
      const targetUsername = urlParams.get('target_username');
      const profileUrl = urlParams.get('profile_url');
      const toastMessage = urlParams.get('toast_message');
      const isFollowing = urlParams.get('is_following') === 'true';
      
      try {
        // ===== CASE 1: Self-follow attempt =====
        if (twitterResult === 'self_follow') {
          console.log('⚠️ Self-follow detected');
          
          await upsert.mutateAsync({ xState: 2 });
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
        if (twitterResult === 'success' || twitterResult === 'recheck_success') {
          console.log('✅ Follow verification successful');
          
          await upsert.mutateAsync({ xState: 3, tgState: 1 });
          cleanUrlParams();
          profileOpenedRef.current = false;
          
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
        if (twitterResult === 'not_following') {
          console.log('❌ User is not following yet');
          
          await upsert.mutateAsync({ xState: 2 });
          cleanUrlParams();
          profileOpenedRef.current = true;
          
          if (targetUsername && profileUrl) {
            // Open profile automatically
            window.open(profileUrl, '_blank', 'noopener,noreferrer');
            
            // Show modal after short delay
            setTimeout(() => {
              setTwitterModal({
                isOpen: true,
                profileUrl,
                targetUsername,
                authData: { needsFollow: true, autoOpen: true }
              });
            }, 500);
            
            toast.success(
              `Connected as @${username}! Follow @${targetUsername} in the opened tab.`,
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
        if (twitterResult === 'still_not_following') {
          console.log('❌ Still not following after recheck');
          
          cleanUrlParams();
          
          if (targetUsername) {
            if (profileUrl) {
              window.open(profileUrl, '_blank', 'noopener,noreferrer');
            }
            
            setTimeout(() => {
              setTwitterModal({
                isOpen: true,
                profileUrl: profileUrl || undefined,
                targetUsername,
                authData: { stillNotFollowing: true }
              });
            }, 500);
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
          cleanUrlParams();
          profileOpenedRef.current = true;
          
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
          cleanUrlParams();
          
          toast(
            toastMessage || `Connected as @${username}. Please complete follow verification.`,
            { 
              duration: 4000,
              icon: 'ℹ️',
              id: 'authenticated'
            }
          );
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

    // Run callback handler
    handleTwitterCallback();
  }, [upsert, cleanUrlParams]); // Stable dependencies

  // ===== AUTO-RECHECK ON TAB FOCUS =====
  useEffect(() => {
    if (xState !== 2) return;

    const handleVisibilityChange = () => {
      if (!document.hidden && profileOpenedRef.current) {
        const now = Date.now();
        const timeSinceLastCheck = now - lastCheckTimeRef.current;
        
        if (timeSinceLastCheck > 5000 && !isRecheckingRef.current) {
          console.log('🔄 Tab became visible, auto-checking follow status...');
          toast.loading('Checking if you followed...', { 
            id: 'visibility-check',
            duration: 2000 
          });
          
          setTimeout(() => {
            handleTwitterRecheckSilent();
          }, 1000);
        }
      }
    };

    const handleWindowFocus = () => {
      if (profileOpenedRef.current) {
        const now = Date.now();
        const timeSinceLastCheck = now - lastCheckTimeRef.current;
        
        if (timeSinceLastCheck > 5000 && !isRecheckingRef.current) {
          console.log('🔄 Window focused, auto-checking follow status...');
          toast.loading('Checking if you followed...', { 
            id: 'focus-check',
            duration: 2000 
          });
          
          setTimeout(() => {
            handleTwitterRecheckSilent();
          }, 1000);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [xState]);

  // ===== INITIATE TWITTER OAUTH =====
  const handleFollowX = useCallback(async () => {
    if (!address || pending) return;
    
    // Reset callback processed flag for new auth flow
    callbackProcessedRef.current = false;
    
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
        return;
      }
      
      const payload = await res.json().catch(() => null);
      
      if (!payload?.ok || !payload?.url) {
        console.error("Invalid /api/twitter/auth response:", payload);
        toast.error(payload?.message || "Invalid OAuth response", { duration: 5000 });
        return;
      }
      
      toast.loading('Redirecting to X (Twitter)...', { duration: 2000 });
      
      setTimeout(() => {
        window.location.assign(payload.url);
      }, 500);
      
    } catch (err) {
      console.error("Twitter auth error:", err);
      toast.error("Failed to start X OAuth", { duration: 5000 });
    } finally {
      setPending(null);
    }
  }, [address, pending]);

  // ===== RECHECK TWITTER FOLLOW STATUS =====
  const handleTwitterRecheck = useCallback(async () => {
    if (!address || pending || isRecheckingRef.current) return;
    
    // Reset callback processed flag for recheck
    callbackProcessedRef.current = false;
    
    isRecheckingRef.current = true;
    lastCheckTimeRef.current = Date.now();
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
        return;
      }
      
      const payload = await res.json();
      
      if (!payload?.ok || !payload?.url) {
        console.error("Invalid recheck auth response:", payload);
        toast.error(payload?.message || "Invalid OAuth response", { duration: 5000, id: 'recheck' });
        return;
      }
      
      toast.dismiss('recheck');
      window.location.assign(payload.url);
      
    } catch (err) {
      console.error("Twitter recheck error:", err);
      toast.error("Failed to verify follow status", { duration: 5000, id: 'recheck' });
    } finally {
      setPending(null);
      isRecheckingRef.current = false;
    }
  }, [address, pending]);

  // ===== SILENT RECHECK =====
  const handleTwitterRecheckSilent = useCallback(async () => {
    if (!address || isRecheckingRef.current) return;
    
    // Reset callback processed flag
    callbackProcessedRef.current = false;
    
    isRecheckingRef.current = true;
    lastCheckTimeRef.current = Date.now();
    
    try {
      const res = await fetch(`/api/twitter/auth?address=${address}&recheck=true`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      
      if (!res.ok) {
        console.error("Silent recheck failed:", res.status);
        toast.dismiss('visibility-check');
        toast.dismiss('focus-check');
        return;
      }
      
      const payload = await res.json();
      
      if (!payload?.ok || !payload?.url) {
        console.error("Invalid silent recheck response:", payload);
        toast.dismiss('visibility-check');
        toast.dismiss('focus-check');
        return;
      }
      
      window.location.assign(payload.url);
      
    } catch (err) {
      console.error("Silent recheck error:", err);
      toast.dismiss('visibility-check');
      toast.dismiss('focus-check');
    } finally {
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