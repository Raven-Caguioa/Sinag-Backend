"use client";

// app/close-yield-round/page.tsx
import { useState, useEffect } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Lock, Loader2, CheckCircle, AlertCircle, Search, TrendingDown } from "lucide-react";
import { 
  PACKAGE_ID,
  ADMIN_CAP, 
  SUI_CLOCK,
  ERROR_MESSAGES 
} from "@/lib/constants";
import { 
  formatCurrency, 
  formatDate,
  formatDateTime,
  getStatusLabel, 
  getStatusColor,
  mistToSui,
  microToUsdc,
  waitForTransaction,
  formatNumber
} from "@/lib/utils";

interface YieldRound {
  round_number: number;
  yield_per_share: string;
  total_deposited: string;
  total_claimed: string;
  claimed_shares: string;
  is_active: boolean;
  opened_at: string;
}

interface Campaign {
  objectId: string;
  name: string;
  location: string;
  status: number;
  total_supply: string;
  coin_type: "SUI" | "USDC";
  current_round: string;
  active_round?: YieldRound;
  created_at: string;
}

export default function CloseYieldRound() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [txDigest, setTxDigest] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchCampaignsWithActiveRounds();
  }, [account]);

  const fetchCampaignsWithActiveRounds = async () => {
    if (!account) {
      setLoadingCampaigns(false);
      return;
    }

    try {
      setLoadingCampaigns(true);

      // Query YieldRoundOpened events
      const openedEvents = await client.queryEvents({
        query: { MoveEventType: `${PACKAGE_ID}::campaign::YieldRoundOpened` },
        order: 'descending',
      });

      // Query YieldRoundClosed events
      const closedEvents = await client.queryEvents({
        query: { MoveEventType: `${PACKAGE_ID}::campaign::YieldRoundClosed` },
        order: 'descending',
      });

      // ⭐ NEW: Query YieldClaimed events to get real claim stats
      const claimedEvents = await client.queryEvents({
        query: { MoveEventType: `${PACKAGE_ID}::campaign::YieldClaimed` },
        order: 'descending',
      });

      // Get campaigns with rounds
      const campaignIds = new Set(
        openedEvents.data.map((e) => (e.parsedJson as any)?.campaign_id)
      );

      // Build a map of campaign -> latest open round event
      const latestOpenRounds = new Map<string, any>();
      openedEvents.data.forEach((e) => {
        const data = e.parsedJson as any;
        const campaignId = data?.campaign_id;
        if (!latestOpenRounds.has(campaignId)) {
          latestOpenRounds.set(campaignId, data);
        }
      });

      // Get closed rounds
      const closedRounds = new Map<string, Set<number>>();
      closedEvents.data.forEach((e) => {
        const data = e.parsedJson as any;
        const campaignId = data?.campaign_id;
        const roundNum = parseInt(data?.round_number || "0");
        
        if (!closedRounds.has(campaignId)) {
          closedRounds.set(campaignId, new Set());
        }
        closedRounds.get(campaignId)!.add(roundNum);
      });

      // ⭐ NEW: Aggregate claim statistics per campaign + round
      const claimStats = new Map<string, { totalClaimed: bigint; claimedShares: number }>();
      claimedEvents.data.forEach((e) => {
        const data = e.parsedJson as any;
        const campaignId = data?.campaign_id;
        const roundNum = parseInt(data?.round_number || "0");
        const amount = data?.amount || "0";
        
        const key = `${campaignId}-${roundNum}`;
        const current = claimStats.get(key) || { totalClaimed: 0n, claimedShares: 0 };
        
        claimStats.set(key, {
          totalClaimed: current.totalClaimed + BigInt(amount),
          claimedShares: current.claimedShares + 1
        });
      });

      if (campaignIds.size === 0) {
        setCampaigns([]);
        setLoadingCampaigns(false);
        return;
      }

      // Fetch campaign objects
      const campaignObjects = await client.multiGetObjects({
        ids: Array.from(campaignIds),
        options: { showContent: true, showType: true },
      });

      const campaignList: Campaign[] = [];

      for (const obj of campaignObjects) {
        if (obj.data?.content?.dataType === "moveObject") {
          const fields = obj.data.content.fields as any;
          const currentRound = parseInt(fields.current_round || "0");
          
          // Skip if no rounds
          if (currentRound === 0) continue;

          // Check if current round is closed
          const roundsClosed = closedRounds.get(obj.data.objectId);
          const isCurrentRoundClosed = roundsClosed?.has(currentRound);
          
          // Skip if current round is already closed
          if (isCurrentRoundClosed) continue;

          const coinType = obj.data.type?.includes("SUI") ? "SUI" : "USDC";

          // Get round info from the opened event
          const latestRoundEvent = latestOpenRounds.get(obj.data.objectId);
          
          if (latestRoundEvent) {
            // ⭐ NEW: Get claim stats for this campaign + round
            const statsKey = `${obj.data.objectId}-${currentRound}`;
            const stats = claimStats.get(statsKey) || { totalClaimed: 0n, claimedShares: 0 };

            // Build active round with REAL claim data
            campaignList.push({
              objectId: obj.data.objectId,
              name: fields.name || "Unknown Campaign",
              location: fields.location || "Unknown",
              status: parseInt(fields.status || "0"),
              total_supply: fields.total_supply || "0",
              coin_type: coinType,
              current_round: fields.current_round || "0",
              active_round: {
                round_number: parseInt(latestRoundEvent.round_number || "0"),
                yield_per_share: latestRoundEvent.yield_per_share || "0",
                total_deposited: latestRoundEvent.total_deposited || "0",
                total_claimed: stats.totalClaimed.toString(), // ✅ Real data
                claimed_shares: stats.claimedShares.toString(), // ✅ Real data
                is_active: true,
                opened_at: latestRoundEvent.timestamp || "0",
              },
              created_at: fields.created_at || "0",
            });
          }
        }
      }

      setCampaigns(campaignList);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      setError("Failed to load campaigns with active yield rounds");
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const handleCloseYieldRound = async () => {
    if (!selectedCampaign) {
      setError("Please select a campaign");
      return;
    }

    if (!account) {
      setError(ERROR_MESSAGES.NO_WALLET);
      return;
    }

    const campaign = campaigns.find((c) => c.objectId === selectedCampaign);
    if (!campaign || !campaign.active_round) {
      setError("Campaign not found or no active round");
      return;
    }

    setLoading(true);
    setError("");
    setTxDigest("");

    try {
      const tx = new Transaction();

      const typeArg = campaign.coin_type === "SUI"
        ? "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI"
        : "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";

      tx.moveCall({
        target: `${PACKAGE_ID}::campaign::close_yield_round`,
        arguments: [
          tx.object(ADMIN_CAP),
          tx.object(selectedCampaign),
          tx.pure.u64(campaign.active_round.round_number),
          tx.object(SUI_CLOCK),
        ],
        typeArguments: [typeArg],
      });

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result) => {
            setTxDigest(result.digest);
            
            try {
              await waitForTransaction(client, result.digest);
              alert("Yield round closed successfully!");
              
              await fetchCampaignsWithActiveRounds();
              setSelectedCampaign("");
            } catch (confirmError) {
              console.error("Confirmation error:", confirmError);
            }
            
            setLoading(false);
          },
          onError: (error) => {
            console.error("Transaction error:", error);
            setError(error.message || ERROR_MESSAGES.TRANSACTION_FAILED);
            setLoading(false);
          },
        }
      );
    } catch (err: any) {
      console.error("Error closing yield round:", err);
      setError(err.message || ERROR_MESSAGES.TRANSACTION_FAILED);
      setLoading(false);
    }
  };

  const filteredCampaigns = campaigns.filter((campaign) =>
    campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-slate-900 dark:text-white mb-2">
          Close Yield Round
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Stop active yield rounds and prevent new claims
        </p>
      </div>

      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30">
        <p className="text-sm text-amber-700 dark:text-amber-400">
          <strong>Note:</strong> Closing a yield round will stop new claims. Unclaimed yield will remain 
          in the campaign balance and can be distributed in future rounds.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search campaigns by name or location..."
          className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#D4AF37] focus:border-transparent transition-all"
        />
      </div>

      <div className="space-y-4">
        {loadingCampaigns ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5 text-center">
            <Lock className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            <p className="text-slate-500 dark:text-slate-400">
              {searchTerm ? "No campaigns found matching your search" : "No campaigns with active yield rounds"}
            </p>
          </div>
        ) : (
          filteredCampaigns.map((campaign) => {
            if (!campaign.active_round) return null;

            const yieldPerShare = campaign.coin_type === "SUI"
              ? mistToSui(campaign.active_round.yield_per_share)
              : microToUsdc(campaign.active_round.yield_per_share);

            const totalDeposited = campaign.coin_type === "SUI"
              ? mistToSui(campaign.active_round.total_deposited)
              : microToUsdc(campaign.active_round.total_deposited);

            const totalClaimed = campaign.coin_type === "SUI"
              ? mistToSui(campaign.active_round.total_claimed)
              : microToUsdc(campaign.active_round.total_claimed);

            const claimProgress = campaign.active_round.total_deposited !== "0"
              ? (parseInt(campaign.active_round.claimed_shares) / parseInt(campaign.total_supply)) * 100
              : 0;

            return (
              <div
                key={campaign.objectId}
                onClick={() => setSelectedCampaign(campaign.objectId)}
                className={`
                  p-6 rounded-2xl border-2 cursor-pointer transition-all
                  ${
                    selectedCampaign === campaign.objectId
                      ? "border-amber-500 dark:border-[#D4AF37] bg-amber-50 dark:bg-[#D4AF37]/10 shadow-lg"
                      : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0a] hover:border-slate-300 dark:hover:border-white/20"
                  }
                `}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">
                      {campaign.name}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {campaign.location}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                        campaign.status
                      )} ${
                        campaign.status === 1
                          ? "bg-blue-100 dark:bg-blue-900/20"
                          : "bg-slate-100 dark:bg-slate-800"
                      }`}
                    >
                      {getStatusLabel(campaign.status)}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 animate-pulse">
                      Round #{campaign.active_round.round_number} Active
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {campaign.coin_type}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Yield per Share
                    </p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(yieldPerShare, campaign.coin_type)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Total Deposited
                    </p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(totalDeposited, campaign.coin_type)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Total Claimed
                    </p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(totalClaimed, campaign.coin_type)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Shares Claimed
                    </p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {formatNumber(campaign.active_round.claimed_shares)} / {formatNumber(campaign.total_supply)}
                    </p>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs font-medium mb-2 text-slate-600 dark:text-slate-300">
                    <span>Claim Progress</span>
                    <span>{claimProgress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all duration-500"
                      style={{ width: `${claimProgress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-200 dark:border-white/10">
                  <span>Opened: {formatDateTime(campaign.active_round.opened_at)}</span>
                  <span className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-medium">
                    Ready to Close
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {txDigest && (
        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
              Yield round closed successfully!
            </p>
            <a
              href={`https://suiexplorer.com/txblock/${txDigest}?network=testnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-green-600 dark:text-green-400 hover:underline font-mono"
            >
              View transaction: {txDigest.slice(0, 20)}...
            </a>
          </div>
        </div>
      )}

      <button
        onClick={handleCloseYieldRound}
        disabled={loading || !selectedCampaign || !account}
        className="w-full py-4 rounded-xl bg-amber-600 dark:bg-amber-500 text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Closing Yield Round...
          </>
        ) : (
          <>
            <TrendingDown className="w-5 h-5" />
            Close Selected Yield Round
          </>
        )}
      </button>

      <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <strong>After closing:</strong> Unclaimed yield remains in the campaign balance. 
          You can open a new round anytime to distribute more yield to NFT holders.
        </p>
      </div>
    </div>
  );
}