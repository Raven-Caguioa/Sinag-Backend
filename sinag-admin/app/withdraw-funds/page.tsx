"use client";

// app/withdraw-funds/page.tsx
import { useState, useEffect } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { DollarSign, Loader2, CheckCircle, AlertCircle, Search, Wallet, Shield } from "lucide-react";
import { 
  PACKAGE_ID,
  OLD_PACKAGE_ID, 
  ADMIN_CAP,
  REGISTRY,
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
  waitForTransaction,
  shortenAddress
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
  closed_at: string | null;
}

export default function WithdrawFunds() {
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
  const [treasuryAddress, setTreasuryAddress] = useState<string>("");

  useEffect(() => {
    fetchTreasuryAddress();
    fetchFinalizedCampaigns();
  }, [account]);

  const fetchTreasuryAddress = async () => {
    if (!account) return;

    try {
      const registryObject = await client.getObject({
        id: REGISTRY,
        options: { showContent: true },
      });

      if (registryObject.data?.content?.dataType === "moveObject") {
        const fields = registryObject.data.content.fields as any;
        setTreasuryAddress(fields.treasury_address || "");
      }
    } catch (err) {
      console.error("Error fetching treasury address:", err);
    }
  };

  const fetchFinalizedCampaigns = async () => {
    console.log("=== STARTING FETCH FOR WITHDRAWAL ===");
    
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

      // Step 2: Query finalized events from BOTH packages
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

      // Step 3: Query withdrawn events from BOTH packages to track campaigns with withdrawn funds
      console.log("Querying withdrawn events...");
      const [v1Withdrawn, v2Withdrawn] = await Promise.all([
        client.queryEvents({ query: { MoveEventType: `${OLD_PACKAGE_ID}::campaign::FundsWithdrawn` } }),
        client.queryEvents({ query: { MoveEventType: `${PACKAGE_ID}::campaign::FundsWithdrawn` } }),
      ]);

      // Track which campaigns have been withdrawn from (may have been partially withdrawn)
      const withdrawnCampaignIds = new Set([
        ...v1Withdrawn.data.map((e) => (e.parsedJson as any)?.campaign_id),
        ...v2Withdrawn.data.map((e) => (e.parsedJson as any)?.campaign_id),
      ]);

      console.log("Withdrawn campaign IDs:", Array.from(withdrawnCampaignIds));

      // Step 4: Filter campaigns that are finalized
      const finalizedCampaigns = createdCampaignIds.filter(
        (id) => finalizedCampaignIds.has(id)
      );

      console.log("Finalized campaigns:", finalizedCampaigns);

      if (!finalizedCampaigns.length) {
        console.log("No finalized campaigns");
        setCampaigns([]);
        setLoadingCampaigns(false);
        return;
      }

      // Step 5: Fetch campaign objects
      console.log("Fetching campaign objects...");
      const campaignObjects = await client.multiGetObjects({
        ids: finalizedCampaigns,
        options: { showContent: true, showType: true },
      });

      const campaignList: Campaign[] = [];

      for (const obj of campaignObjects) {
        if (obj.data?.content?.dataType === "moveObject") {
          const fields = obj.data.content.fields as any;
          const isFinalized = fields.is_finalized === true;
          const balance = fields.balance || "0";

          // Only include if finalized AND has balance > 0
          if (isFinalized && parseInt(balance) > 0) {
            const coinType = obj.data.type?.includes("SUI") ? "SUI" : "USDC";

            campaignList.push({
              objectId: obj.data.objectId,
              name: fields.name || "Unknown Campaign",
              location: fields.location || "Unknown",
              status: parseInt(fields.status || "0"),
              shares_sold: fields.shares_sold || "0",
              total_supply: fields.total_supply || "0",
              balance,
              is_finalized: isFinalized,
              coin_type: coinType,
              created_at: fields.created_at || "0",
              closed_at: fields.closed_at || null,
            });
          }
        }
      }

      console.log("Final campaigns available for withdrawal:", campaignList);
      setCampaigns(campaignList);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      setError("Failed to load finalized campaigns");
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const handleWithdrawFunds = async () => {
    if (!selectedCampaign) {
      setError("Please select a campaign to withdraw from");
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

    if (parseInt(campaign.balance) === 0) {
      setError("No funds available to withdraw");
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
        target: `${PACKAGE_ID}::campaign::withdraw_funds`,
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
              
              const withdrawnAmount = campaign.coin_type === "SUI"
                ? mistToSui(campaign.balance)
                : microToUsdc(campaign.balance);
              
              alert(`Successfully withdrew ${formatCurrency(withdrawnAmount, campaign.coin_type)}!`);
              
              await fetchFinalizedCampaigns();
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
      console.error("Error withdrawing funds:", err);
      setError(err.message || ERROR_MESSAGES.TRANSACTION_FAILED);
      setLoading(false);
    }
  };

  const filteredCampaigns = campaigns.filter((campaign) =>
    campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedCampaignData = campaigns.find((c) => c.objectId === selectedCampaign);
  const withdrawAmount = selectedCampaignData
    ? selectedCampaignData.coin_type === "SUI"
      ? mistToSui(selectedCampaignData.balance)
      : microToUsdc(selectedCampaignData.balance)
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-slate-900 dark:text-white mb-2">
          Withdraw Funds
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Withdraw funds from finalized campaigns to the Project Treasury Wallet
        </p>
      </div>

      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white dark:bg-[#111]">
            <Shield className="w-5 h-5 text-blue-600 dark:text-[#D4AF37]" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
              Destination: {treasuryAddress ? "Project Treasury" : "Loading..."}
            </p>
            <p className="font-mono text-sm text-slate-900 dark:text-white break-all">
              {treasuryAddress ? shortenAddress(treasuryAddress, 8) : "—"}
            </p>
          </div>
          <div className="px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800/50">
            <span className="text-xs font-semibold text-green-700 dark:text-green-400">
              Secure
            </span>
          </div>
        </div>
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
            <DollarSign className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
            <p className="text-slate-500 dark:text-slate-400">
              {searchTerm ? "No campaigns found matching your search" : "No finalized campaigns with funds available"}
            </p>
          </div>
        ) : (
          filteredCampaigns.map((campaign) => {
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
                      Shares Sold
                    </p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {campaign.shares_sold}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Total Supply
                    </p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {campaign.total_supply}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Available Balance
                    </p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(raised, campaign.coin_type)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-200 dark:border-white/10">
                  <span>Created: {formatDate(campaign.created_at)}</span>
                  {campaign.closed_at && (
                    <span>Closed: {formatDate(campaign.closed_at)}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedCampaignData && (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/10 border-2 border-green-200 dark:border-green-800/30">
          <h3 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-4">
            Withdrawal Summary
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-green-700 dark:text-green-400">Campaign</span>
              <span className="text-sm font-semibold text-green-900 dark:text-green-100">
                {selectedCampaignData.name}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-green-700 dark:text-green-400">Amount</span>
              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                {formatCurrency(withdrawAmount, selectedCampaignData.coin_type)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-green-700 dark:text-green-400">Recipient</span>
              <span className="text-sm font-mono text-green-900 dark:text-green-100">
                {treasuryAddress ? shortenAddress(treasuryAddress, 6) : "—"}
              </span>
            </div>
          </div>
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
              Funds withdrawn successfully!
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
        onClick={handleWithdrawFunds}
        disabled={loading || !selectedCampaign || !account}
        className="w-full py-4 rounded-xl bg-green-600 dark:bg-green-500 text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing Withdrawal...
          </>
        ) : (
          <>
            <DollarSign className="w-5 h-5" />
            {selectedCampaignData
              ? `Withdraw ${formatCurrency(withdrawAmount, selectedCampaignData.coin_type)}`
              : "Select Campaign to Withdraw"}
          </>
        )}
      </button>

      <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <strong>Note:</strong> Funds are programmatically transferred to the Project Treasury Wallet. 
          Your connected wallet is only used to sign the transaction (for gas fees). The destination address 
          is hardcoded in the smart contract for security.
        </p>
      </div>
    </div>
  );
}