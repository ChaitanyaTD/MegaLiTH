"use client";

import { useAccount } from "wagmi";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
// import KiltBalance from "@/components/KiltBalance";
import { useProgress } from "@/hooks/useProgress";
import { useBoost } from "@/hooks/useBoost";
import ReferralInviteModal from "@/components/InviteRefferalModal";
import TaskButtons from "@/app/dashboard/TaskButtons";
import Image from "next/image";

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, isFetched } = useProgress();
  const { data: boostData, calculateBoost, isCalculating } = useBoost();
  const didInitRef = useRef(false);
  const [userReady, setUserReady] = useState(false);
  const [referralLink, setReferralLink] = useState<string | null>(null);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [hasProcessedReferral, setHasProcessedReferral] = useState(false);
  const [refCodeFromURL, setRefCodeFromURL] = useState<string | null>(null);

  // Capture ref code from URL
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) setRefCodeFromURL(ref);
  }, [searchParams]);

  // ✅ Show referral modal once wallet is connected
  useEffect(() => {
    if (isConnected && refCodeFromURL && !hasProcessedReferral) {
      setShowReferralModal(true);
    }
  }, [isConnected, refCodeFromURL, hasProcessedReferral]);

  // Fetch or create user
  useEffect(() => {
    if (!isConnected) {
      router.replace("/");
      return;
    }
    if (!didInitRef.current && isFetched) {
      didInitRef.current = true;
      fetch(`/api/user?address=${address}`)
        .then(async (r) => (r.ok ? r.json() : null))
        .then(async (existing) => {
          if (existing?.id) {
            setUserReady(true);
            if (existing.progress?.referralCode) {
              const refLink = `${window.location.origin}/?ref=${existing.progress.referralCode}`;
              setReferralLink(refLink);
            }
            // Silently compute and store boost on login
            try {
              await fetch("/api/boost/calculate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ address }),
              });
            } catch (error) {
              console.error("Failed to calculate boost after login", { address, error });
            }
            return;
          }
          const r = await fetch("/api/user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address }),
          });
          if (r.ok) {
            setUserReady(true);
            // After creating user, compute and store boost
            try {
              await fetch("/api/boost/calculate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ address }),
              });
            } catch (error) {
              console.error("Failed to calculate boost after user creation", { address, error });
            }
          }
        })
        .catch((error) => {
          console.error("Failed to fetch or create user", { address, error });
        });
    }
  }, [isConnected, router, isFetched, data, address]);

  const handleRedeemReferral = async (code: string) => {
    if (!address) throw new Error("Wallet not connected");

    const response = await fetch("/api/referral/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newUserAddress: address, referralCode: code }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to redeem referral code");
    }
    setHasProcessedReferral(true);
    setShowReferralModal(false);
  };

  const handleCopyReferralLink = () => {
    if (referralLink) navigator.clipboard.writeText(referralLink);
  };

  return (
    <>
      <ReferralInviteModal
        isOpen={showReferralModal}
        onClose={() => setShowReferralModal(false)}
        onRedeem={handleRedeemReferral}
      />

      <div className="p-6">
        <div className="flex justify-between items-center max-w-6xl mx-auto"></div>

        <div className="max-w-6xl mx-auto grid gap-8">
          <section>
            <h2 className="heading text-2xl font-semibold">Holder Boost</h2>
            <div className="mt-4 p-6 bg-gradient-to-r from-orange-50 to-blue-50 dark:from-orange-900/20 dark:to-blue-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-2">
                    Boost Tokens
                  </h3>
                  <div className="flex items-center space-x-4 mb-3">
                    <div className="flex items-center justify-center">
                      <Image src="/assets/BNB Logo.png" alt="BNB" width={40} height={40} className="w-10 h-10" />
                    </div>
                    <div className="flex items-center justify-center">
                      <Image src="/assets/ASTER Logo.png" alt="ASTER" width={40} height={40} className="w-10 h-10" />
                    </div>
                    <div className="flex items-center justify-center">
                      <Image src="/assets/kilt-logo.png" alt="KILT" width={40} height={40} className="w-10 h-10" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Hold these tokens to get boost multipliers
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold flex items-center">
                    {boostData?.boostCoefficient && boostData.boostCoefficient > 1.0 ? (
                      <>
                        <span className="mr-2">✅</span>
                        <span className="text-green-600 dark:text-green-400">
                          Boost tokens detected
                        </span>
                      </>
                    ) : boostData?.hasBnbTokens || boostData?.hasAsterTokens || boostData?.hasKiltTokens ? (
                      <>
                        <span className="mr-2">⚠️</span>
                        <span className="text-yellow-600 dark:text-yellow-400">
                          Tokens held, below minimum
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="mr-2">❌</span>
                        <span className="text-red-600 dark:text-red-400">No boost tokens</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={calculateBoost}
                    disabled={isCalculating}
                    className="mt-2 text-xs text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-200 disabled:opacity-50"
                  >
                    {isCalculating ? "Checking..." : "Check Boost"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="heading text-2xl font-semibold">Genesis Drop</h2>
            <TaskButtons disabled={!userReady} setReferralLink={setReferralLink} />

            {referralLink && (
              <div className="mt-10">
                <p className="text-xl font-semibold mb-3">Your unique referral link:</p>
                <div className="flex gap-2 items-center">
                  <input
                    className="flex-1 card rounded-md p-3 font-mono text-sm"
                    value={referralLink}
                    readOnly
                  />
                  <button
                    onClick={handleCopyReferralLink}
                    className="btn btn-secondary rounded-xl px-6 py-3 whitespace-nowrap"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
