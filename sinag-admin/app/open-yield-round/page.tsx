"use client";

// app/open-yield-round/page.tsx
import { useState, useEffect } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { TrendingUp, Loader2, CheckCircle, AlertCircle, Search, DollarSign } from "lucide-react";
import { 
  PACKAGE_ID,
  ADMIN_CAP, 
  SUI_CLOCK,
  ERROR_MESSAGES 
} from "@/lib/constants";
import { 
  formatCurrency, 
  formatDate, 
  getStatusLabel, 
  getStatusColor,
  mistToSui,
  microToUsdc,
  suiToMist,
  usdcToMicro,
  waitForTransaction,
  shortenAddress,
  formatNumber
} from "@/lib/utils";

interface Campaign {
  objectId: string;
  name: string;
  location: string;
  status: number;
  total_supply: string;
  shares_sold: string;
  balance: string;
  is_finalized: boolean;
  coin_type: "SUI" | "USDC";
  current_round: string;
  total_yield_distributed: string;
  created_at: string;
}

export default function OpenYieldRound() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [yieldPerShare, setYieldPerShare] = useState<string>("");
  const [txDigest, setTxDigest] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchClosedCampaigns();
  }, [account]);

  const fetchClosedCampaigns = async () => {
    if (!account) {
      setLoadingCampaigns(false);
      return;
    }

    try {
      setLoadingCampaigns(true);

      // Query CampaignCreated events (only from new package with yield support)
      const events = await client.queryEvents({
        query: { MoveEventType: `${PACKAGE_ID}::campaign::CampaignCreated` },
        order: 'descending',
      });

      const campaignIds = events.data
        .map((e) => (e.parsedJson as any)?.campaign_id)
        .filter(Boolean);

      if (!campaignIds.length) {
        setCampaigns([]);
        setLoadingCampaigns(false);
        return;
      }

      // Fetch campaign objects
      const campaignObjects = await client.multiGetObjects({
        ids: campaignIds,
        options: { showContent: true, showType: true },
      });

      const campaignList: Campaign[] = [];

      for (const obj of campaignObjects) {
        if (obj.data?.content?.dataType === "moveObject") {
          const fields = obj.data.content.fields as any;
          const status = parseInt(fields.status || "0");
          const isFinalized = fields.is_finalized === true;

          // Only show closed/completed campaigns that are finalized
          if (status !== 0 && isFinalized) {
            const coinType = obj.data.type?.includes("SUI") ? "SUI" : "USDC";

            campaignList.push({
              objectId: obj.data.objectId,
              name: fields.name || "Unknown Campaign",
              location: fields.location || "Unknown",
              status: status,
              total_supply: fields.total_supply || "0",
              shares_sold: fields.shares_sold || "0",
              balance: fields.balance || "0",
              is_finalized: isFinalized,
              coin_type: coinType,
              current_round: fields.current_round || "0",
              total_yield_distributed: fields.total_yield_distributed || "0",
              created_at: fields.created_at || "0",
            });
          }
        }
      }

      setCampaigns(campaignList);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      setError("Failed to load finalized campaigns");
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const handleOpenYieldRound = async () => {
    if (!selectedCampaign) {
      setError("Please select a campaign");
      return;
    }

    if (!yieldPerShare || parseFloat(yieldPerShare) <= 0) {
      setError("Please enter a valid yield per share amount");
      return;
    }

    if (!account) {
      setError(ERROR_MESSAGES.NO_WALLET);
      return;
    }

    const campaign = campaigns.find((c) => c.objectId === selectedCampaign);
    if (!campaign) {
      setError("Campaign not found");
      return;
    }

    setLoading(true);
    setError("");
    setTxDigest("");

    try {
      const tx = new Transaction();

      // Convert yield per share to smallest unit
      const yieldPerShareSmallest = campaign.coin_type === "SUI"
        ? suiToMist(parseFloat(yieldPerShare))
        : usdcToMicro(parseFloat(yieldPerShare));

      // Calculate total deposit needed
      const totalShares = parseInt(campaign.total_supply);
      const totalDeposit = BigInt(yieldPerShareSmallest) * BigInt(totalShares);

      // Split coins to get exact amount
      const [depositCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(totalDeposit.toString())]);

      const typeArg = campaign.coin_type === "SUI"
        ? "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI"
        : "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";

      tx.moveCall({
        target: `${PACKAGE_ID}::campaign::open_yield_round`,
        arguments: [
          tx.object(ADMIN_CAP),
          tx.object(selectedCampaign),
          tx.pure.u64(yieldPerShareSmallest),
          depositCoin,
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
              alert("Yield round opened successfully!");
              
              await fetchClosedCampaigns();
              setSelectedCampaign("");
              setYieldPerShare("");
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
      console.error("Error opening yield round:", err);
      setError(err.message || ERROR_MESSAGES.TRANSACTION_FAILED);
      setLoading(false);
    }
  };

  const filteredCampaigns = campaigns.filter((campaign) =>
    campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedCampaignData = campaigns.find((c) => c.objectId === selectedCampaign);
  const totalYieldNeeded = selectedCampaignData && yieldPerShare
    ? parseFloat(yieldPerShare) * parseInt(selectedCampaignData.total_supply)
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-slate-900 dark:text-white mb-2">
          Open Yield Round
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Start a new yield distribution round for finalized campaigns
        </p>
      </div>

      {account && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/10 border border-green-200 dark:border-green-800/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white dark:bg-[#111]">
              <DollarSign className="w-5 h-5 text-green-600 dark:text-[#D4AF37]" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Depositing From
              </p>
              <p className="font-mono text-sm text-slate-900 dark:text-white">
                {shortenAddress(account.address, 8)}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30">
        <p className="text-sm text-blue-700 dark:text-blue-400">
          <strong>How it works:</strong> Set the yield per share, and the contract will calculate 
          the total deposit needed (yield × total supply). All NFT holders can then claim their share.
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
            <TrendingUp className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            <p className="text-slate-500 dark:text-slate-400">
              {searchTerm ? "No campaigns found matching your search" : "No finalized campaigns available"}
            </p>
          </div>
        ) : (
          filteredCampaigns.map((campaign) => {
            const totalYieldDist = campaign.coin_type === "SUI"
              ? mistToSui(campaign.total_yield_distributed)
              : microToUsdc(campaign.total_yield_distributed);

            return (
              <div
                key={campaign.objectId}
                onClick={() => setSelectedCampaign(campaign.objectId)}
                className={`
                  p-6 rounded-2xl border-2 cursor-pointer transition-all
                  ${
                    selectedCampaign === campaign.objectId
                      ? "border-green-500 dark:border-[#D4AF37] bg-green-50 dark:bg-[#D4AF37]/10 shadow-lg"
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
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                      Finalized
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {campaign.coin_type}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Total Shares
                    </p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {formatNumber(campaign.total_supply)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Current Round
                    </p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      #{campaign.current_round}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Total Distributed
                    </p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(totalYieldDist, campaign.coin_type)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-200 dark:border-white/10">
                  <span>Created: {formatDate(campaign.created_at)}</span>
                  {campaign.current_round === "0" && (
                    <span className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-medium">
                      No rounds yet
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedCampaignData && (
        <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Configure Yield Round
          </h3>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Yield Per Share ({selectedCampaignData.coin_type}) *
            </label>
            <input
              type="number"
              step="0.000001"
              value={yieldPerShare}
              onChange={(e) => {
                setYieldPerShare(e.target.value);
                setError("");
              }}
              placeholder="1.5"
              className="w-full px-4 py-3 rounded-lg bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 dark:focus:ring-[#D4AF37] focus:border-transparent transition-all"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Amount each NFT holder will receive
            </p>
          </div>

          {yieldPerShare && parseFloat(yieldPerShare) > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/10 border border-green-200 dark:border-green-800/30">
              <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-3">
                Round Summary
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-green-700 dark:text-green-400">Yield per Share</span>
                  <span className="text-sm font-semibold text-green-900 dark:text-green-100">
                    {formatCurrency(parseFloat(yieldPerShare), selectedCampaignData.coin_type)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-green-700 dark:text-green-400">Total Shares</span>
                  <span className="text-sm font-semibold text-green-900 dark:text-green-100">
                    {formatNumber(selectedCampaignData.total_supply)}
                  </span>
                </div>
                <div className="pt-2 border-t border-green-200 dark:border-green-800/30">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                      Total Deposit Required
                    </span>
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(totalYieldNeeded, selectedCampaignData.coin_type)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
              Yield round opened successfully!
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
        onClick={handleOpenYieldRound}
        disabled={loading || !selectedCampaign || !yieldPerShare || !account}
        className="w-full py-4 rounded-xl bg-green-600 dark:bg-green-500 text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Opening Yield Round...
          </>
        ) : (
          <>
            <TrendingUp className="w-5 h-5" />
            {selectedCampaignData && yieldPerShare
              ? `Deposit ${formatCurrency(totalYieldNeeded, selectedCampaignData.coin_type)} & Open Round`
              : "Configure Yield Round"}
          </>
        )}
      </button>

      <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <strong>Note:</strong> Once a yield round is opened, all NFT holders can claim their yield. 
          You can close the round anytime from the "Close Yield Round" page.
        </p>
      </div>
    </div>
  );
}