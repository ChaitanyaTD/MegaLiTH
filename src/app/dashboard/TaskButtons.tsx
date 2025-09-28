"use client";

import { useProgress } from "@/hooks/useProgress";
import { useState, useEffect } from "react";
import { useAccount } from "wagmi";

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
  const completed = state === 3; // Changed to state 3 for fully completed
  const authenticated = state === 2; // State 2 for authenticated but not following
  const initial = state === 1; // State 1 for initial state

  return (
    <button
      disabled={disabled || loading}
      onClick={onClick}
      className={`rounded-2xl p-6 text-xl font-semibold transition-colors relative ${
        completed
          ? "bg-green-700 text-white"
          : authenticated
          ? "bg-blue-600 text-white hover:bg-blue-700"
          : initial
          ? "bg-[#1f2326] hover:bg-[#262a2d] text-white"
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

// Modal component for Twitter follow instructions
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

  // Auto-check functionality
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    const handleAutoCheck = async () => {
      console.log("Auto-checking follow status...");
      onFollowed();
    };

    if (autoCheckEnabled && isOpen) {
      // Start checking every 3 seconds
      interval = setInterval(handleAutoCheck, 3000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [autoCheckEnabled, isOpen, onFollowed]);

  const handleOpenProfile = () => {
    if (profileUrl) {
      // Open profile in new tab
      window.open(profileUrl, '_blank', 'noopener,noreferrer');
      
      // Enable auto-checking after opening profile
      setAutoCheckEnabled(true);
      
      // Show instruction that auto-check is enabled
      setTimeout(() => {
        alert("Profile opened! We'll automatically check when you follow them. You can also click 'I Followed Them' manually.");
      }, 1000);
    }
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
            Please follow @{targetUsername} on X (Twitter) to continue.
          </p>
          
          {autoCheckEnabled && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-blue-700 dark:text-blue-300 text-sm">
                    {`Auto-checking follow status... Follow @${targetUsername} and we'll detect it automatically!`}
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
              onClick={() => {
                setIsFollowing(true);
                onFollowed();
              }}
              disabled={isFollowing}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFollowing ? 'Checking...' : 'I Followed Them'}
            </button>
            
            <button
              onClick={() => {
                setAutoCheckEnabled(false);
                onClose();
              }}
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

  // State meanings:
  // 0: Disabled/locked
  // 1: Available to start
  // 2: Authenticated but not following (for X)
  // 3: Completed
  const xState = data?.xState ?? 1;
  const tgState = data?.tgState ?? 0;
  const refState = data?.refState ?? 0;

  // Check if we're returning from Twitter auth
  useEffect(() => {
    const checkTwitterCallback = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const twitterResult = urlParams.get('twitter_result');
      const username = urlParams.get('username');
      const targetUsername = urlParams.get('target_username');
      const profileUrl = urlParams.get('profile_url');
      const errorMessage = urlParams.get('error_message');
      
      if (twitterResult) {
        // Remove URL params
        window.history.replaceState({}, document.title, window.location.pathname);
        
        switch (twitterResult) {
          case 'success':
          case 'recheck_success':
            // User is following, update to completed state
            upsert.mutateAsync({ xState: 3 });
            alert(`✅ Successfully verified! You are following @${targetUsername || 'the target account'}.`);
            break;
            
          case 'not_following':
            // User is not following, show modal and open profile
            upsert.mutateAsync({ xState: 2 });
            if (targetUsername && profileUrl) {
              // Auto-open the profile in a new tab
              window.open(profileUrl, '_blank', 'noopener,noreferrer');
              
              // Show modal with auto-check enabled
              setTwitterModal({
                isOpen: true,
                profileUrl,
                targetUsername,
                authData: { needsFollow: true }
              });
              
              alert(`Connected as @${username}! Please follow @${targetUsername} in the opened tab, then return here.`);
            } else {
              alert(`Connected as @${username}. Please follow the required account to continue.`);
            }
            break;
            
          case 'manual_check':
            // API check failed, show manual instructions
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
              alert(`Connected as @${username}. Manual verification required - please follow @${targetUsername}.`);
            }
            break;
            
          case 'still_not_following':
            // User tried to recheck but still not following
            alert(`❌ Still not following @${targetUsername}. Please make sure you followed them and try again.`);
            if (targetUsername) {
              // Auto-open profile again
              if (profileUrl) {
                window.open(profileUrl, '_blank', 'noopener,noreferrer');
              }
              setTwitterModal({
                isOpen: true,
                profileUrl: profileUrl || undefined,
                targetUsername,
                authData: { stillNotFollowing: true }
              });
            }
            break;
            
          case 'authenticated':
            // Basic authentication successful but need to check follow
            upsert.mutateAsync({ xState: 2 });
            alert(`Connected as @${username}. Please complete the follow verification.`);
            break;
            
          case 'error':
            // Handle authentication errors
            console.error('Twitter auth error:', errorMessage);
            alert(`❌ Authentication failed: ${errorMessage || 'Unknown error'}`);
            break;
        }
      }
    };

    checkTwitterCallback();
  }, [upsert, setTwitterModal]);

  const handleFollowX = async () => {
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
          alert(errorData.message || "Failed to start X OAuth");
        } catch {
          alert("Failed to start X OAuth");
        }
        return;
      }
      
      const payload = await res.json().catch(() => null);
      
      if (!payload?.ok || !payload?.url) {
        console.error("Invalid /api/twitter/auth response:", payload);
        alert(payload?.message || "Invalid OAuth response");
        return;
      }
      
      // Redirect to Twitter OAuth
      window.location.assign(payload.url);
      
    } catch (err) {
      console.error("Twitter auth error:", err);
      alert("Failed to start X OAuth");
    } finally {
      setPending(null);
    }
  };

  const handleTwitterRecheck = async () => {
    if (!address || pending) return;
    
    setPending("x");
    try {
      // Simply redirect to re-authenticate and check follow status
      const res = await fetch(`/api/twitter/auth?address=${address}&recheck=true`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      
      if (!res.ok) {
        const txt = await res.text().catch(() => "no body");
        console.error("Twitter recheck auth failed:", res.status, txt);
        alert("Failed to initiate follow verification");
        return;
      }
      
      const payload = await res.json();
      
      if (!payload?.ok || !payload?.url) {
        console.error("Invalid recheck auth response:", payload);
        alert(payload?.message || "Invalid OAuth response");
        return;
      }
      
      // Redirect to Twitter OAuth for re-verification
      window.location.assign(payload.url);
      
    } catch (err) {
      console.error("Twitter recheck error:", err);
      alert("Failed to verify follow status");
    } finally {
      setPending(null);
    }
  };

  const handleModalFollowed = async () => {
    setTwitterModal(prev => ({ ...prev, isOpen: false }));
    
    // Wait a moment for the follow to register, then recheck
    setTimeout(() => {
      handleTwitterRecheck();
    }, 2000);
  };

  const handleJoinTG = async () => {
    if (!address || pending) return;
    setPending("tg");
    try {
      // Telegram verification flow
      const telegramUserId = prompt("Enter your Telegram User ID for verification");
      if (!telegramUserId) throw new Error("Telegram ID required");
      
      const res = await fetch("/api/telegram/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ address, telegramUserId }),
      });
      
      if (!res.ok) {
        const txt = await res.text().catch(() => "no body");
        console.error("Telegram verify failed:", res.status, txt);
        alert("Telegram verification failed");
        return;
      }
      
      const data = await res.json().catch(() => null);
      if (data?.verified) {
        await upsert.mutateAsync({ tgState: 3, refState: 1 }); // Enable referral after TG
      } else {
        alert("Telegram not verified");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPending(null);
    }
  };

  const handleGetReferral = async () => {
    if (!address || pending) return;
    setPending("ref");
    try {
      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ address }),
      });
      
      if (!res.ok) {
        const txt = await res.text().catch(() => "no body");
        console.error("Referral request failed:", res.status, txt);
        alert("Failed to generate referral");
        return;
      }
      
      const referral = await res.json().catch(() => null);
      console.log("Referral generated:", referral);
      await upsert.mutateAsync({ refState: 3 }); // Mark as completed
    } catch (err) {
      console.error(err);
    } finally {
      setPending(null);
    }
  };

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