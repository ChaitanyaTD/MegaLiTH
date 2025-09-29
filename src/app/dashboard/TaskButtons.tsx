"use client";

import { useProgress } from "@/hooks/useProgress";
import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";

// ===== BUTTON COMPONENT =====
// Displays task buttons with different states
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
  const completed = state === 3; // State 3: Fully completed
  const authenticated = state === 2; // State 2: Authenticated but incomplete
  const initial = state === 1; // State 1: Ready to start

  return (
    <button
      disabled={disabled || loading}
      onClick={onClick}
      className={`rounded-2xl p-6 text-xl font-semibold transition-colors relative ${
        completed
          ? "bg-green-700 text-white"
          : authenticated
          ? "bg-green-700 text-white"
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
// Modal for guiding users to follow the target account
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

  // ===== Auto-check follow status every 3 seconds =====
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    const handleAutoCheck = async () => {
      setCheckCount(prev => prev + 1);
      console.log(`🔄 Auto-checking follow status (attempt ${checkCount + 1})...`);
      
      // Show toast every 3 checks
      if ((checkCount + 1) % 3 === 0) {
        toast.loading(`Checking follow status... (${checkCount + 1})`, {
          id: 'auto-check',
          duration: 2000
        });
      }
      
      // Trigger recheck
      onFollowed();
    };

    if (autoCheckEnabled && isOpen) {
      // Start checking every 3 seconds
      interval = setInterval(handleAutoCheck, 3000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
        toast.dismiss('auto-check');
      }
    };
  }, [autoCheckEnabled, isOpen, onFollowed, checkCount]);

  // ===== Open Twitter profile and enable auto-checking =====
  const handleOpenProfile = () => {
    if (profileUrl) {
      // Open profile in new tab
      window.open(profileUrl, '_blank', 'noopener,noreferrer');
      
      // Enable auto-checking after opening profile
      setAutoCheckEnabled(true);
      setCheckCount(0);
      
      // Show instruction toast
      toast.success(`Profile opened! Follow @${targetUsername} and we'll detect it automatically.`, {
        duration: 5000,
        icon: '👀'
      });
    }
  };

  // ===== Manual "I Followed Them" button =====
  const handleManualFollow = () => {
    setIsFollowing(true);
    toast.loading('Verifying follow status...', { id: 'manual-check' });
    
    // Add small delay before checking
    setTimeout(() => {
      toast.dismiss('manual-check');
      onFollowed();
    }, 1000);
  };

  // ===== Close modal and stop auto-checking =====
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

  // ===== STATE DEFINITIONS =====
  // 0: Disabled/locked
  // 1: Available to start
  // 2: Authenticated but not complete (Twitter: not following, Telegram: not joined)
  // 3: Completed
  const xState = data?.xState ?? 1;
  const tgState = data?.tgState ?? 0;
  const refState = data?.refState ?? 0;

  // ===== HANDLE TWITTER CALLBACK RESULTS =====
  // This processes URL parameters after Twitter OAuth redirect
  useEffect(() => {
    const handleTwitterCallback = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const twitterResult = urlParams.get('twitter_result');
      const username = urlParams.get('username');
      const targetUsername = urlParams.get('target_username');
      const profileUrl = urlParams.get('profile_url');
      const errorMessage = urlParams.get('error_message');
      const toastType = urlParams.get('toast_type');
      const toastMessage = urlParams.get('toast_message');
      
      if (!twitterResult) return;

      // Clean URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Show toast if provided
      if (toastMessage && toastType) {
        switch (toastType) {
          case 'success':
            toast.success(toastMessage, { duration: 5000 });
            break;
          case 'error':
            toast.error(toastMessage, { duration: 6000 });
            break;
          case 'warning':
            toast(toastMessage, { duration: 5000, icon: '⚠️' });
            break;
          case 'info':
            toast(toastMessage, { duration: 4000, icon: 'ℹ️' });
            break;
        }
      }
      
      // ===== CASE 1: Self-follow attempt =====
      if (twitterResult === 'self_follow') {
        // Update to state 2 (authenticated but not following)
        // This prevents enabling the Telegram button
        upsert.mutateAsync({ xState: 2 });
        // Toast already shown from callback
        return;
      }
      
      // ===== CASE 2: Successfully following =====
      if (twitterResult === 'success' || twitterResult === 'recheck_success') {
        // Update to state 3 (completed) and enable Telegram button
        upsert.mutateAsync({ xState: 3, tgState: 1 });
        // Toast already shown from callback
        return;
      }
      
      // ===== CASE 3: Not following - open profile automatically =====
      if (twitterResult === 'not_following') {
        // Update to state 2 (authenticated but not following)
        upsert.mutateAsync({ xState: 2 });
        
        if (targetUsername && profileUrl) {
          // Automatically open the profile in new tab
          window.open(profileUrl, '_blank', 'noopener,noreferrer');
          
          // Show modal with auto-check enabled
          setTimeout(() => {
            setTwitterModal({
              isOpen: true,
              profileUrl,
              targetUsername,
              authData: { needsFollow: true, autoOpen: true }
            });
          }, 500);
          
          toast.success(`Connected as @${username}! Follow @${targetUsername} in the opened tab.`, {
            duration: 6000,
            icon: '👋'
          });
        }
        return;
      }
      
      // ===== CASE 4: Manual verification needed =====
      if (twitterResult === 'manual_check') {
        upsert.mutateAsync({ xState: 2 });
        
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
        // Toast already shown from callback
        return;
      }
      
      // ===== CASE 5: Still not following after recheck =====
      if (twitterResult === 'still_not_following') {
        // Keep state at 2
        if (targetUsername) {
          // Auto-open profile again
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
        // Toast already shown from callback
        return;
      }
      
      // ===== CASE 6: Basic authentication =====
      if (twitterResult === 'authenticated') {
        upsert.mutateAsync({ xState: 2 });
        // Toast already shown from callback
        return;
      }
      
      // ===== CASE 7: Error handling =====
      if (twitterResult === 'error') {
        // Toast already shown from callback
        console.error('Twitter auth error:', errorMessage);
      }
    };

    handleTwitterCallback();
  }, [upsert]);

  // ===== INITIATE TWITTER OAUTH =====
  const handleFollowX = useCallback(async () => {
    if (!address || pending) return;
    
    setPending("x");
    try {
      const res = await fetch(`/api/twitter/auth?address=${address}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      
      if (!res.ok) {
        const txt = await res.text().catch(() => "no body");
        console.error("Twitter auth request failed:", res.status, txt);
        
        // Try to parse error message
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
      
      // Show loading toast and redirect
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
    if (!address || pending) return;
    
    setPending("x");
    try {
      toast.loading('Verifying follow status...', { id: 'recheck' });
      
      // Re-authenticate to check follow status
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
      
      // Redirect to Twitter OAuth for verification
      toast.dismiss('recheck');
      window.location.assign(payload.url);
      
    } catch (err) {
      console.error("Twitter recheck error:", err);
      toast.error("Failed to verify follow status", { duration: 5000, id: 'recheck' });
    } finally {
      setPending(null);
    }
  }, [address, pending]);

  // ===== MODAL: User clicked "I Followed Them" =====
  const handleModalFollowed = useCallback(() => {
    setTwitterModal(prev => ({ ...prev, isOpen: false }));
    
    // Wait for modal to close, then recheck
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
      
      // Telegram verification flow
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
        await upsert.mutateAsync({ tgState: 3, refState: 1 }); // Enable referral after TG
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

  // ===== GET BUTTON TEXT BASED ON STATE =====
  const getXButtonText = () => {
    switch (xState) {
      case 0:
        return "Follow Megalith on X (Locked)";
      case 1:
        return "Follow Megalith on X";
      case 2:
        return "Complete X Follow";
      case 3:
        return "✓ Following Megalith on X";
      default:
        return "Follow Megalith on X";
    }
  };

  // ===== GET BUTTON ACTION BASED ON STATE =====
  const getXButtonAction = () => {
    if (disabled) return undefined;
    
    switch (xState) {
      case 1:
        return handleFollowX; // Initial OAuth
      case 2:
        return handleTwitterRecheck; // Recheck follow status
      default:
        return undefined; // Completed or locked
    }
  };

  return (
    <>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-6 opacity-100">
        {/* ===== TWITTER/X BUTTON ===== */}
        <Btn 
          state={disabled ? 0 : xState} 
          onClick={getXButtonAction()}
          loading={pending === "x"}
        >
          {getXButtonText()}
        </Btn>
        
        {/* ===== TELEGRAM BUTTON ===== */}
        {/* Only enabled after Twitter follow is complete (xState === 3) */}
        <Btn 
          state={disabled || pending === "tg" ? 0 : tgState} 
          onClick={!disabled && tgState === 1 ? handleJoinTG : undefined}
          loading={pending === "tg"}
        >
          {tgState === 3 ? "✓ Joined Telegram" : "Join Telegram"}
        </Btn>
        
        {/* ===== REFERRAL BUTTON ===== */}
        {/* Only enabled after Telegram is complete (tgState === 3) */}
        <Btn 
          state={disabled || pending === "ref" ? 0 : refState} 
          onClick={!disabled && refState === 1 ? handleGetReferral : undefined}
          loading={pending === "ref"}
        >
          {refState === 3 ? "✓ Referral Generated" : "Reveal Referral Link"}
        </Btn>
      </div>

      {/* ===== TWITTER FOLLOW MODAL ===== */}
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

// ===== COMPLETE FLOW SUMMARY =====
// 
// 1️⃣ INITIAL TWITTER OAUTH (xState: 1 → 2)
//    - User clicks "Follow Megalith on X"
//    - Redirects to Twitter OAuth
//    - After auth, callback checks follow status
//    - If not following: auto-opens profile, shows modal with auto-check
//    - Updates xState to 2 (authenticated but not following)
//
// 2️⃣ FOLLOW VERIFICATION (xState: 2 → 3)
//    - Modal auto-checks every 3 seconds
//    - Or user clicks "I Followed Them"
//    - Re-authenticates to verify follow status
//    - If following: updates xState to 3, enables Telegram button
//    - If not following: shows error toast, keeps modal open
//
// 3️⃣ SELF-FOLLOW DETECTION
//    - If user tries to follow their own account
//    - Callback detects: twitterUserId === TARGET_TWITTER_ID
//    - Shows error toast: "You cannot follow your own account"
//    - Keeps xState at 2 (does NOT enable Telegram)
//    - Does NOT show modal or auto-open profile
//
// 4️⃣ TELEGRAM VERIFICATION (tgState: 1 → 3)
//    - Only enabled after xState === 3
//    - User enters Telegram ID
//    - Backend verifies Telegram membership
//    - Updates tgState to 3, enables referral button
//
// 5️⃣ REFERRAL GENERATION (refState: 1 → 3)
//    - Only enabled after tgState === 3
//    - Generates unique referral link
//    - Updates refState to 3 (completed)
//
// STATE PROGRESSION:
// Twitter: 1 (start) → 2 (authenticated) → 3 (following)
// Telegram: 0 (locked) → 1 (available) → 3 (complete)
// Referral: 0 (locked) → 1 (available) → 3 (complete)