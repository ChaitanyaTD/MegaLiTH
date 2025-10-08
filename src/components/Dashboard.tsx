"use client";

import { useAccount } from "wagmi";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import KiltBalance from "@/components/KiltBalance";
import { useProgress } from "@/hooks/useProgress";
import ReferralInviteModal from "@/components/InviteRefferalModal";
import TaskButtons from "@/app/dashboard/TaskButtons";

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, isFetched } = useProgress();
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

  // Show referral modal
  useEffect(() => {
    if (refCodeFromURL && isConnected && !hasProcessedReferral) {
      setShowReferralModal(true);
    }
  }, [refCodeFromURL, isConnected, hasProcessedReferral]);

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
            return;
          }
          const r = await fetch("/api/user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address }),
          });
          if (r.ok) setUserReady(true);
        })
        .catch(() => {});
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
            <h2 className="heading text-2xl font-semibold">Genesis Drop</h2>
            <div className="mt-4 grid sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm opacity-80 mb-1">KILT balance</label>
                <div className="w-full card rounded-md p-3 font-mono">
                  <KiltBalance />
                </div>
              </div>
              <div>
                <label className="block text-sm opacity-80 mb-1">M1 allocation</label>
                <input
                  className="w-full card rounded-md p-3 font-mono"
                  value={"34,420.00"}
                  readOnly
                />
              </div>
            </div>
            <p className="mt-4 opacity-80 text-sm">
              The snapshot is scheduled for Block 3482000 around 12:00 on October 20th, 2025.
            </p>
          </section>

          <section className="mt-10">
            <h2 className="heading text-2xl font-semibold">Alliance Drop</h2>
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
