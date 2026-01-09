"use client";

// app/finalize-campaign/page.tsx
import { useState, useEffect } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { CheckCircle, Loader2, AlertCircle, Search, Lock } from "lucide-react";
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
  is_finalized: boolean;
  coin_type: "SUI" | "USDC";
  created_at: string;
}

export default function FinalizeCampaign() {
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
    fetchClosedCampaigns();
  }, [account]);

    const fetchClosedCampaigns = async () => {
    console.log("=== STARTING FETCH FOR FINALIZATION ===");
    
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

      // Step 2: Query closed events (completed + manually closed) from BOTH packages
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

      // Step 3: Query finalized events from BOTH packages
      console.log("Querying finalized events...");
      const [v1Finalized, v2Finalized] = await Promise.all([
        client.queryEvents({ query: { MoveEventType: `${OLD_PACKAGE_ID}::campaign::CampaignFinalized` } }),
        client.queryEvents({ query: { MoveEventType: `${PACKAGE_ID}::campaign::CampaignFinalized` } }),
      ]);

      const finalizedCampaignIds = new Set([
        ...v1Finalized.data.map((e) => (e.parsedJson as any)?.campaign_id),
        ...v2Finalized.data.map((e) => (e.parsedJson as any)?.campaign_id),
      ]);

      console.log("Finalized campaign IDs:", Array.from(finalizedCampaignIds));

      // Step 4: Filter campaigns that are closed but NOT finalized
      const campaignsToFinalize = createdCampaignIds.filter(
        (id) => closedCampaignIds.has(id) && !finalizedCampaignIds.has(id)
      );

      console.log("Campaigns ready to finalize:", campaignsToFinalize);

      if (!campaignsToFinalize.length) {
        console.log("No campaigns ready to finalize");
        setCampaigns([]);
        setLoadingCampaigns(false);
        return;
      }

      // Step 5: Fetch campaign objects
      console.log("Fetching campaign objects...");
      const campaignObjects = await client.multiGetObjects({
        ids: campaignsToFinalize,
        options: { showContent: true, showType: true },
      });

      const campaignList: Campaign[] = [];

      for (const obj of campaignObjects) {
        if (obj.data?.content?.dataType === "moveObject") {
          const fields = obj.data.content.fields as any;
          const status = parseInt(fields.status || "0");
          const isFinalized = fields.is_finalized === true;

          // Double-check: only include if not active and not finalized
          if (status !== STATUS_ACTIVE && !isFinalized) {
            const coinType = obj.data.type?.includes("SUI") ? "SUI" : "USDC";

            campaignList.push({
              objectId: obj.data.objectId,
              name: fields.name || "Unknown Campaign",
              location: fields.location || "Unknown",
              status: status,
              shares_sold: fields.shares_sold || "0",
              total_supply: fields.total_supply || "0",
              balance: fields.balance || "0",
              is_finalized: isFinalized,
              coin_type: coinType,
              created_at: fields.created_at || "0",
            });
          }
        }
      }

      console.log("Final campaigns to finalize:", campaignList);
      setCampaigns(campaignList);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      setError("Failed to load closed campaigns");
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const handleFinalizeCampaign = async () => {
    if (!selectedCampaign) {
      setError("Please select a campaign to finalize");
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
        target: `${PACKAGE_ID}::campaign::finalize_campaign`,
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
              alert("Campaign finalized successfully!");
              
              await fetchClosedCampaigns();
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
      console.error("Error finalizing campaign:", err);
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
          Finalize Campaign
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Finalize closed campaigns to enable fund withdrawal
        </p>
      </div>

      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30">
        <p className="text-sm text-blue-700 dark:text-blue-400">
          <strong>Note:</strong> A campaign must be finalized before funds can be withdrawn. 
          This is a required step after manually closing a campaign or after it completes.
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
              {searchTerm ? "No campaigns found matching your search" : "No closed campaigns available to finalize"}
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
                      )} ${
                        campaign.status === 1
                          ? "bg-blue-100 dark:bg-blue-900/20"
                          : "bg-slate-100 dark:bg-slate-800"
                      }`}
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

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Created: {formatDate(campaign.created_at)}</span>
                  {!campaign.is_finalized && (
                    <span className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-medium">
                      Ready to Finalize
                    </span>
                  )}
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
              Campaign finalized successfully!
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
        onClick={handleFinalizeCampaign}
        disabled={loading || !selectedCampaign || !account}
        className="w-full py-4 rounded-xl bg-slate-900 dark:bg-[#D4AF37] text-white dark:text-black font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Finalizing Campaign...
          </>
        ) : (
          <>
            <CheckCircle className="w-5 h-5" />
            Finalize Selected Campaign
          </>
        )}
      </button>

      <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          After finalizing, you'll be able to withdraw the campaign funds from the "Withdraw Funds" page.
        </p>
      </div>
    </div>
  );
}