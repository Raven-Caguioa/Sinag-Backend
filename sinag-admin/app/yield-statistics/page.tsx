"use client";

// app/yield-statistics/page.tsx
import { useState, useEffect } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { 
  TrendingUp, 
  Loader2, 
  DollarSign, 
  Users, 
  Target,
  BarChart3,
  Search,
  Eye
} from "lucide-react";
import { PACKAGE_ID } from "@/lib/constants";
import { 
  formatCurrency, 
  formatDate,
  formatDateTime,
  mistToSui,
  microToUsdc,
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
  closed_at: string | null;
}

interface Campaign {
  objectId: string;
  name: string;
  location: string;
  total_supply: string;
  shares_sold: string;
  coin_type: "SUI" | "USDC";
  unique_investors: string;
  current_round: string;
  total_yield_distributed: string;
  yield_rounds: YieldRound[];
  created_at: string;
}

export default function YieldStatistics() {
  const client = useSuiClient();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaignsWithYield();
  }, []);

  const fetchCampaignsWithYield = async () => {
    try {
      setLoading(true);

      // Query CampaignCreated events
      const events = await client.queryEvents({
        query: { MoveEventType: `${PACKAGE_ID}::campaign::CampaignCreated` },
        order: 'descending',
      });

      const campaignIds = events.data
        .map((e) => (e.parsedJson as any)?.campaign_id)
        .filter(Boolean);

      if (!campaignIds.length) {
        setCampaigns([]);
        setLoading(false);
        return;
      }

      // ⭐ NEW: Query YieldRoundOpened events
      const openedEvents = await client.queryEvents({
        query: { MoveEventType: `${PACKAGE_ID}::campaign::YieldRoundOpened` },
        order: 'descending',
      });

      // ⭐ NEW: Query YieldRoundClosed events
      const closedEvents = await client.queryEvents({
        query: { MoveEventType: `${PACKAGE_ID}::campaign::YieldRoundClosed` },
        order: 'descending',
      });

      // ⭐ NEW: Query YieldClaimed events
      const claimedEvents = await client.queryEvents({
        query: { MoveEventType: `${PACKAGE_ID}::campaign::YieldClaimed` },
        order: 'descending',
      });

      // Build map of opened rounds by campaign
      const roundsMap = new Map<string, Map<number, any>>();
      openedEvents.data.forEach((e) => {
        const data = e.parsedJson as any;
        const campaignId = data?.campaign_id;
        const roundNum = parseInt(data?.round_number || "0");
        
        if (!roundsMap.has(campaignId)) {
          roundsMap.set(campaignId, new Map());
        }
        roundsMap.get(campaignId)!.set(roundNum, {
          round_number: roundNum,
          yield_per_share: data?.yield_per_share || "0",
          total_deposited: data?.total_deposited || "0",
          opened_at: data?.timestamp || "0",
          is_active: true,
          closed_at: null,
        });
      });

      // Mark closed rounds
      closedEvents.data.forEach((e) => {
        const data = e.parsedJson as any;
        const campaignId = data?.campaign_id;
        const roundNum = parseInt(data?.round_number || "0");
        
        const campaignRounds = roundsMap.get(campaignId);
        if (campaignRounds && campaignRounds.has(roundNum)) {
          const round = campaignRounds.get(roundNum);
          round.is_active = false;
          round.closed_at = data?.timestamp || null;
        }
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

      // Fetch campaign objects
      const campaignObjects = await client.multiGetObjects({
        ids: campaignIds,
        options: { showContent: true, showType: true },
      });

      const campaignList: Campaign[] = [];

      for (const obj of campaignObjects) {
        if (obj.data?.content?.dataType === "moveObject") {
          const fields = obj.data.content.fields as any;
          const currentRound = parseInt(fields.current_round || "0");

          // Only include campaigns that have at least one yield round
          if (currentRound > 0) {
            const coinType = obj.data.type?.includes("SUI") ? "SUI" : "USDC";
            const campaignId = obj.data.objectId;

            // Get rounds for this campaign from events
            const campaignRounds = roundsMap.get(campaignId);
            const yieldRounds: YieldRound[] = [];

            if (campaignRounds) {
              // Sort rounds by number
              const sortedRounds = Array.from(campaignRounds.entries()).sort(
                ([a], [b]) => a - b
              );

              for (const [roundNum, roundData] of sortedRounds) {
                // ⭐ NEW: Get claim stats for this round
                const statsKey = `${campaignId}-${roundNum}`;
                const stats = claimStats.get(statsKey) || { totalClaimed: 0n, claimedShares: 0 };

                yieldRounds.push({
                  round_number: roundData.round_number,
                  yield_per_share: roundData.yield_per_share,
                  total_deposited: roundData.total_deposited,
                  total_claimed: stats.totalClaimed.toString(), // ✅ Real data
                  claimed_shares: stats.claimedShares.toString(), // ✅ Real data
                  is_active: roundData.is_active,
                  opened_at: roundData.opened_at,
                  closed_at: roundData.closed_at,
                });
              }
            }

            campaignList.push({
              objectId: campaignId,
              name: fields.name || "Unknown Campaign",
              location: fields.location || "Unknown",
              total_supply: fields.total_supply || "0",
              shares_sold: fields.shares_sold || "0",
              coin_type: coinType,
              unique_investors: fields.unique_investors || "0",
              current_round: fields.current_round || "0",
              total_yield_distributed: fields.total_yield_distributed || "0",
              yield_rounds: yieldRounds,
              created_at: fields.created_at || "0",
            });
          }
        }
      }

      setCampaigns(campaignList);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCampaigns = campaigns.filter((campaign) =>
    campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate global stats
  const totalYieldDistributedSUI = campaigns
    .filter((c) => c.coin_type === "SUI")
    .reduce((sum, c) => sum + mistToSui(c.total_yield_distributed), 0);

  const totalYieldDistributedUSDC = campaigns
    .filter((c) => c.coin_type === "USDC")
    .reduce((sum, c) => sum + microToUsdc(c.total_yield_distributed), 0);

  const totalRounds = campaigns.reduce((sum, c) => sum + parseInt(c.current_round), 0);
  const totalInvestors = campaigns.reduce((sum, c) => sum + parseInt(c.unique_investors), 0);

  const selectedCampaignData = selectedCampaign
    ? campaigns.find((c) => c.objectId === selectedCampaign)
    : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-slate-900 dark:text-white mb-2">
          Yield Statistics
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Track yield distribution across all campaigns
        </p>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-800/10 border border-green-200 dark:border-green-800/30">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2 rounded-lg bg-green-500 dark:bg-green-600">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs text-green-600 dark:text-green-400 font-semibold">
              SUI YIELD
            </span>
          </div>
          <p className="text-3xl font-bold text-green-900 dark:text-green-100 mb-1">
            {formatNumber(totalYieldDistributedSUI.toFixed(2))}
          </p>
          <p className="text-sm text-green-600 dark:text-green-400">
            Total Distributed
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-100 dark:from-blue-900/20 dark:to-cyan-800/10 border border-blue-200 dark:border-blue-800/30">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2 rounded-lg bg-blue-500 dark:bg-blue-600">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
              USDC YIELD
            </span>
          </div>
          <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mb-1">
            {formatNumber(totalYieldDistributedUSDC.toFixed(2))}
          </p>
          <p className="text-sm text-blue-600 dark:text-blue-400">
            Total Distributed
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-100 dark:from-purple-900/20 dark:to-pink-800/10 border border-purple-200 dark:border-purple-800/30">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2 rounded-lg bg-purple-500 dark:bg-purple-600">
              <Target className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold">
              ROUNDS
            </span>
          </div>
          <p className="text-3xl font-bold text-purple-900 dark:text-purple-100 mb-1">
            {formatNumber(totalRounds)}
          </p>
          <p className="text-sm text-purple-600 dark:text-purple-400">
            Total Yield Rounds
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/20 dark:to-orange-800/10 border border-amber-200 dark:border-amber-800/30">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2 rounded-lg bg-amber-500 dark:bg-amber-600">
              <Users className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
              INVESTORS
            </span>
          </div>
          <p className="text-3xl font-bold text-amber-900 dark:text-amber-100 mb-1">
            {formatNumber(totalInvestors)}
          </p>
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Unique Investors
          </p>
        </div>
      </div>

      {/* Search */}
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

      {/* Campaigns List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5 text-center">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            <p className="text-slate-500 dark:text-slate-400">
              {searchTerm
                ? "No campaigns found matching your search"
                : "No campaigns with yield rounds yet"}
            </p>
          </div>
        ) : (
          filteredCampaigns.map((campaign) => {
            const totalYieldDist = campaign.coin_type === "SUI"
              ? mistToSui(campaign.total_yield_distributed)
              : microToUsdc(campaign.total_yield_distributed);

            const isExpanded = selectedCampaign === campaign.objectId;

            return (
              <div
                key={campaign.objectId}
                className="p-6 rounded-2xl bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5"
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
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {campaign.coin_type}
                    </span>
                    <button
                      onClick={() =>
                        setSelectedCampaign(
                          isExpanded ? null : campaign.objectId
                        )
                      }
                      className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Eye className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Total Yield
                    </p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(totalYieldDist, campaign.coin_type)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Rounds
                    </p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {campaign.current_round}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Investors
                    </p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {formatNumber(campaign.unique_investors)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Shares
                    </p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {formatNumber(campaign.total_supply)}
                    </p>
                  </div>
                </div>

                {/* Expanded Round Details */}
                {isExpanded && campaign.yield_rounds.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                      Yield Round History
                    </h4>
                    <div className="space-y-3">
                      {campaign.yield_rounds.map((round) => {
                        const yieldPerShare = campaign.coin_type === "SUI"
                          ? mistToSui(round.yield_per_share)
                          : microToUsdc(round.yield_per_share);

                        const totalDeposited = campaign.coin_type === "SUI"
                          ? mistToSui(round.total_deposited)
                          : microToUsdc(round.total_deposited);

                        const totalClaimed = campaign.coin_type === "SUI"
                          ? mistToSui(round.total_claimed)
                          : microToUsdc(round.total_claimed);

                        const claimRate =
                          round.total_deposited !== "0"
                            ? (parseInt(round.claimed_shares) /
                                parseInt(campaign.total_supply)) *
                              100
                            : 0;

                        return (
                          <div
                            key={round.round_number}
                            className="p-4 rounded-xl bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                  Round #{round.round_number}
                                </span>
                                {round.is_active ? (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                                    Active
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400">
                                    Closed
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {formatDate(round.opened_at)}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                                  Per Share
                                </p>
                                <p className="font-semibold text-slate-900 dark:text-white">
                                  {formatCurrency(
                                    yieldPerShare,
                                    campaign.coin_type
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                                  Deposited
                                </p>
                                <p className="font-semibold text-slate-900 dark:text-white">
                                  {formatCurrency(
                                    totalDeposited,
                                    campaign.coin_type
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                                  Claimed
                                </p>
                                <p className="font-semibold text-green-600 dark:text-green-400">
                                  {formatCurrency(
                                    totalClaimed,
                                    campaign.coin_type
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                                  Claim Rate
                                </p>
                                <p className="font-semibold text-slate-900 dark:text-white">
                                  {claimRate.toFixed(1)}%
                                </p>
                              </div>
                            </div>

                            <div className="mt-3">
                              <div className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all duration-500"
                                  style={{ width: `${claimRate}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-4 pt-3 border-t border-slate-200 dark:border-white/10">
                  <span>Created: {formatDate(campaign.created_at)}</span>
                  <span>
                    {campaign.yield_rounds.length} round
                    {campaign.yield_rounds.length !== 1 ? "s" : ""} total
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}