"use client";

// app/close-campaign/page.tsx
import { useState, useEffect } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { XCircle, Loader2, CheckCircle, AlertCircle, Search } from "lucide-react";
import { 
  PACKAGE_ID,
  OLD_PACKAGE_ID, 
  ADMIN_CAP, 
  REGISTRY, 
  SUI_CLOCK,
  STATUS_ACTIVE,
  ERROR_MESSAGES 
} from "@/lib/constants";
import { 
  formatCurrency, 
  formatDate, 
  getStatusLabel, 
  getStatusColor,
  mistToSui,
  microToUsdc,
  waitForTransaction,
  calculateProgress
} from "@/lib/utils";

interface Campaign {
  objectId: string;
  name: string;
  location: string;
  status: number;
  shares_sold: string;
  total_supply: string;
  balance: string;
  coin_type: "SUI" | "USDC";
  created_at: string;
}

export default function CloseCampaign() {
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
    fetchActiveCampaigns();
  }, [account]);

  const fetchActiveCampaigns = async () => {
  console.log("=== STARTING FETCH ===");
  
  if (!account) {
    console.log("No account connected");
    setLoadingCampaigns(false);
    return;
  }

  try {
    setLoadingCampaigns(true);

    // Step 1: Query CampaignCreated events from BOTH package versions
    console.log("Querying CampaignCreated events from both packages...");
    const [v1Events, v2Events] = await Promise.all([
      client.queryEvents({
        query: { MoveEventType: `${OLD_PACKAGE_ID}::campaign::CampaignCreated` },
        order: 'descending',
      }),
      client.queryEvents({
        query: { MoveEventType: `${PACKAGE_ID}::campaign::CampaignCreated` },
        order: 'descending',
      })
    ]);

    console.log("V1 events:", v1Events.data.length);
    console.log("V2 events:", v2Events.data.length);

    const allCreatedEvents = [...v1Events.data, ...v2Events.data];
    console.log("Total created events:", allCreatedEvents.length);

    const createdCampaignIds = allCreatedEvents
      .map((e) => (e.parsedJson as any)?.campaign_id)
      .filter(Boolean);

    console.log("Created campaign IDs:", createdCampaignIds);

    if (!createdCampaignIds.length) {
      console.log("No campaign IDs found");
      setCampaigns([]);
      setLoadingCampaigns(false);
      return;
    }

    // Step 2: Query closed events from BOTH packages
    console.log("Querying closed events...");
    const [v1Completed, v2Completed, v1Manual, v2Manual] = await Promise.all([
      client.queryEvents({ query: { MoveEventType: `${OLD_PACKAGE_ID}::campaign::CampaignCompleted` } }),
      client.queryEvents({ query: { MoveEventType: `${PACKAGE_ID}::campaign::CampaignCompleted` } }),
      client.queryEvents({ query: { MoveEventType: `${OLD_PACKAGE_ID}::campaign::CampaignManuallyClosed` } }),
      client.queryEvents({ query: { MoveEventType: `${PACKAGE_ID}::campaign::CampaignManuallyClosed` } }),
    ]);

    const closedCampaignIds = new Set([
      ...v1Completed.data.map((e) => (e.parsedJson as any)?.campaign_id),
      ...v2Completed.data.map((e) => (e.parsedJson as any)?.campaign_id),
      ...v1Manual.data.map((e) => (e.parsedJson as any)?.campaign_id),
      ...v2Manual.data.map((e) => (e.parsedJson as any)?.campaign_id),
    ]);

    console.log("Closed campaign IDs:", Array.from(closedCampaignIds));

    // Step 3: Filter active campaigns
    const activeCampaignIds = createdCampaignIds.filter(
      (id) => !closedCampaignIds.has(id)
    );

    console.log("Active campaign IDs:", activeCampaignIds);

    if (!activeCampaignIds.length) {
      console.log("No active campaigns");
      setCampaigns([]);
      setLoadingCampaigns(false);
      return;
    }

    // Step 4: Fetch campaign objects
    console.log("Fetching campaign objects...");
    const campaignObjects = await client.multiGetObjects({
      ids: activeCampaignIds,
      options: { showContent: true, showType: true },
    });

    const campaignList: Campaign[] = [];

    for (const obj of campaignObjects) {
      if (obj.data?.content?.dataType === "moveObject") {
        const fields = obj.data.content.fields as any;
        const status = parseInt(fields.status || "0");

        if (status === STATUS_ACTIVE) {
          const coinType = obj.data.type?.includes("SUI") ? "SUI" : "USDC";

          campaignList.push({
            objectId: obj.data.objectId,
            name: fields.name || "Unknown Campaign",
            location: fields.location || "Unknown",
            status: status,
            shares_sold: fields.shares_sold || "0",
            total_supply: fields.total_supply || "0",
            balance: fields.balance || "0",
            coin_type: coinType,
            created_at: fields.created_at || "0",
          });
        }
      }
    }

    console.log("Final campaigns:", campaignList);
    setCampaigns(campaignList);
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    setError("Failed to load active campaigns");
  } finally {
    setLoadingCampaigns(false);
  }
};

  const handleCloseCampaign = async () => {
    if (!selectedCampaign) {
      setError("Please select a campaign to close");
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

      const typeArg = campaign.coin_type === "SUI"
        ? "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI"
        : "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";

      tx.moveCall({
        target: `${PACKAGE_ID}::campaign::close_campaign_manually`,
        arguments: [
          tx.object(ADMIN_CAP),
          tx.object(REGISTRY),
          tx.object(selectedCampaign),
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
              alert("Campaign closed successfully!");
              
              await fetchActiveCampaigns();
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
      console.error("Error closing campaign:", err);
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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-slate-900 dark:text-white mb-2">
          Close Campaign
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Manually close an active campaign before it reaches full funding
        </p>
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

      {/* Active Campaigns List */}
      <div className="space-y-4">
        {loadingCampaigns ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5 text-center">
            <p className="text-slate-500 dark:text-slate-400">
              {searchTerm ? "No campaigns found matching your search" : "No active campaigns available to close"}
            </p>
          </div>
        ) : (
          filteredCampaigns.map((campaign) => {
            const progress = calculateProgress(campaign.shares_sold, campaign.total_supply);
            const raised = campaign.coin_type === "SUI"
              ? mistToSui(campaign.balance)
              : microToUsdc(campaign.balance);

            return (
              <div
                key={campaign.objectId}
                onClick={() => setSelectedCampaign(campaign.objectId)}
                className={`
                  p-6 rounded-2xl border-2 cursor-pointer transition-all
                  ${
                    selectedCampaign === campaign.objectId
                      ? "border-blue-500 dark:border-[#D4AF37] bg-blue-50 dark:bg-[#D4AF37]/10"
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
                      )} bg-green-100 dark:bg-green-900/20`}
                    >
                      {getStatusLabel(campaign.status)}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {campaign.coin_type}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Shares Sold
                    </p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {campaign.shares_sold} / {campaign.total_supply}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Total Raised
                    </p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(raised, campaign.coin_type)}
                    </p>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs font-medium mb-2 text-slate-600 dark:text-slate-300">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-900 dark:bg-[#D4AF37] rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Created: {formatDate(campaign.created_at)}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Success Display */}
      {txDigest && (
        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
              Campaign closed successfully!
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

      {/* Action Button */}
      <button
        onClick={handleCloseCampaign}
        disabled={loading || !selectedCampaign || !account}
        className="w-full py-4 rounded-xl bg-red-600 dark:bg-red-500 text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Closing Campaign...
          </>
        ) : (
          <>
            <XCircle className="w-5 h-5" />
            Close Selected Campaign
          </>
        )}
      </button>

      {/* Warning */}
      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30">
        <p className="text-sm text-amber-700 dark:text-amber-400">
          <strong>Warning:</strong> Closing a campaign will stop all new investments. 
          Existing investors will retain their shares. This action cannot be undone.
        </p>
      </div>
    </div>
  );
}