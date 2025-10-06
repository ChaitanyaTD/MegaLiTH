"use client";

import { useProgress } from "@/hooks/useProgress";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

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

// ===== MAIN TASK BUTTONS COMPONENT =====
export default function TaskButtons({ disabled ,setReferralLink}: { disabled?: boolean ,setReferralLink: (link: string | null) => void }) {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { data, upsert, refetch } = useProgress();
  const [pending, setPending] = useState<null | "x" | "tg" | "ref">(null);

  const callbackProcessedRef = useRef(false);
  const profileOpenedRef = useRef(false);

  // Get raw states from database
  const xState = data?.xState ?? 1;
  const tgState = data?.tgState ?? 0;
  const refState = data?.refState ?? 0;
  const xVerified = data?.xVerified ?? false;

  console.log('📊 Current states:', { xState, tgState, refState, xVerified, disabled });

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
      if (callbackProcessedRef.current) return;

      const urlParams = new URLSearchParams(window.location.search);
      const twitterResult = urlParams.get('twitter_result');
      
      if (!twitterResult) return;

      callbackProcessedRef.current = true;
      console.log(`🔄 Processing Twitter callback: ${twitterResult}`);

      const username = urlParams.get('username');
      const targetUsername = urlParams.get('target_username');
      const profileUrl = urlParams.get('profile_url');
      const toastMessage = urlParams.get('toast_message');
      
      cleanUrlParams();
      
      try {
        if (twitterResult === 'success') {
          await refetch();
          
          // Open Twitter profile for user to follow
          if (profileUrl && !profileOpenedRef.current) {
            window.open(profileUrl, '_blank', 'noopener,noreferrer');
            profileOpenedRef.current = true;
          }
          
          toast.success(
            toastMessage || `Connected as @${username}! All tasks unlocked. Follow @${targetUsername} to stay verified.`,
            { duration: 8000 }
          );
          return;
        }
        
        if (twitterResult === 'error') {
          toast.error(
            toastMessage || 'Twitter authentication failed. Please try again.',
            { duration: 6000 }
          );
          return;
        }
        
      } catch (error) {
        console.error('❌ Error processing Twitter callback:', error);
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

      // Poll for verification
      let pollCount = 0;
      const maxPolls = 300; // 10 minutes (300 * 2 seconds)
      
      const interval = setInterval(async () => {
        pollCount++;
        
        try {
          const r = await fetch("/api/telegram/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address }),
          });
          
          const pollData = await r.json();
          
          console.log('Telegram poll result:', pollData);
          
          if (pollData.verified && pollData.tgState === 3) {
            clearInterval(interval);
            toast.success("Telegram verified ✅");
            
            // Invalidate and refetch to get fresh data from server
            queryClient.invalidateQueries({ queryKey: ["progress", address] });
            const refetchResult = await refetch();
            console.log('Refetch completed:', refetchResult.data);

            setPending(null);
            
            console.log('Telegram verified, UI should update now');
            return;
          }
          
          if (pollCount >= maxPolls) {
            clearInterval(interval);
            toast.error("Verification timeout. Please try again.");
            setPending(null);
          }
        } catch (err) {
          console.error('Telegram polling error:', err);
        }
      }, 2000);

    } catch (err) {
      console.error(err);
      toast.error("Failed to open Telegram bot.", { id: "telegram" });
      setPending(null);
    }
  };

  // ===== HANDLE REFERRAL GENERATION =====
  const [referralType, setReferralType] = useState<'twitter' | 'telegram' | null>(null);
  
  const handleGetReferral = async () => {
    if (!address || pending) return;
    
    // Show selection dialog
    setReferralType(null); // Reset selection
    setPending("ref");
  };

  const generateReferralWithType = async (type: 'twitter' | 'telegram') => {
    if (!address) return;
    
    try {
      toast.loading('Generating referral link...', { id: 'referral' });
      
      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ address, type }),
      });
      
      if (!res.ok) {
        toast.error("Failed to generate referral", { duration: 5000, id: 'referral' });
        setPending(null);
        return;
      }
      
      const data = await res.json();
      
      // Log referral link to console
      console.log('===========================================');
      console.log('REFERRAL LINK GENERATED:');
      console.log(data.referralLink);
      console.log('Referral Code:', data.referralCode);
      console.log('Type:', type);
      console.log('===========================================');
      
      await upsert.mutateAsync({ refState: 3 });
      await refetch();
      
      toast.success(`✅ Referral link generated using ${type === 'twitter' ? 'Twitter' : 'Telegram'} username!`, { duration: 5000, id: 'referral' });
      if (data.referralLink){
      setReferralLink(data.referralLink);
      } else {
        setReferralLink(null);
      }
      setReferralType(null);
      setPending(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate referral", { duration: 5000, id: 'referral' });
      setPending(null);
    }
  };

  // ===== CALCULATE DISPLAY STATES =====
  const displayXState = disabled ? 0 : xState;
  const displayTgState = disabled ? 0 : (xState === 3 ? Math.max(tgState, 1) : 0);
  const displayRefState = disabled ? 0 : (tgState === 3 ? Math.max(refState, 1) : 0);

  // ===== GET BUTTON TEXT =====
  const getXButtonText = () => {
    if (pending === "x") return "Connecting...";
    
    switch (displayXState) {
      case 0:
        return "Follow Megalith on X (Locked)";
      case 1:
        return "Follow Megalith on X";
      case 2:
        return "Complete X Follow";
      case 3:
        return xVerified ? "✓ Following Megalith on X" : "✓ Following Megalith (Verifying...)";
      default:
        return "Follow Megalith on X";
    }
  };

  // ===== GET BUTTON ACTION =====
  const getXButtonAction = () => {
    if (disabled) return undefined;
    return displayXState === 1 || displayXState === 2 ? handleFollowX : undefined;
  };

  return (
    <>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-6 opacity-100">
        <Btn 
          state={displayXState} 
          onClick={getXButtonAction()}
          loading={pending === "x"}
        >
          {getXButtonText()}
        </Btn>
        
        <Btn 
          state={pending === "tg" ? 2 : displayTgState} 
          onClick={displayTgState === 1 ? handleJoinTG : undefined} 
          loading={pending === "tg"}
        >
          {displayTgState === 3 ? "✓ Joined Telegram" : "Join Telegram"}
        </Btn>
        
        <Btn 
          state={pending === "ref" ? 0 : displayRefState} 
          onClick={displayRefState === 1 ? handleGetReferral : undefined}
          loading={pending === "ref"}
        >
          {displayRefState === 3 ? "✓ Referral Generated" : "Reveal Referral Link"}
        </Btn>
      </div>

      {/* Referral Type Selection Modal */}
      {pending === "ref" && referralType === null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#1a1d21] rounded-2xl p-8 max-w-md w-full mx-4 border border-gray-800">
            <h3 className="text-2xl font-bold text-white mb-4">Choose Referral Type</h3>
            <p className="text-gray-400 mb-6">Select which username to use for your referral link:</p>
            
            <div className="space-y-4">
              <button
                onClick={() => generateReferralWithType('twitter')}
                className="w-full bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white font-semibold py-4 px-6 rounded-xl transition-colors flex items-center justify-between"
              >
                <span>Use Twitter Username</span>
                <span className="text-sm opacity-80">@{data?.twitterId || 'username'}</span>
              </button>
              
              <button
                onClick={() => generateReferralWithType('telegram')}
                className="w-full bg-[#0088cc] hover:bg-[#006699] text-white font-semibold py-4 px-6 rounded-xl transition-colors flex items-center justify-between"
              >
                <span>Use Telegram Username</span>
                <span className="text-sm opacity-80">@{data?.telegramUsername || 'username'}</span>
              </button>
            </div>
            
            <button
              onClick={() => {
                setPending(null);
                setReferralType(null);
              }}
              className="w-full mt-4 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}