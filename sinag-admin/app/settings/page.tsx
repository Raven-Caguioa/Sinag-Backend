"use client";

// app/settings/page.tsx
// Platform Settings - Manage Registry State
import { useState, useEffect } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Settings, Loader2, CheckCircle, AlertCircle, Shield, Pause, Play, Wallet, UserPlus, Users } from "lucide-react";
import { 
  PACKAGE_ID,
  ADMIN_CAP, 
  REGISTRY,
  SUI_CLOCK,
  ERROR_MESSAGES 
} from "@/lib/constants";
import { 
  shortenAddress,
  waitForTransaction 
} from "@/lib/utils";
import { CampaignRegistry } from "@/lib/types";
import { getAdminCaps } from "@/lib/admins";
import { ADMIN_CAP_TYPE } from "@/lib/constants";

export default function PlatformSettings() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [registry, setRegistry] = useState<CampaignRegistry | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [txDigest, setTxDigest] = useState<string>("");
  const [newTreasuryAddress, setNewTreasuryAddress] = useState<string>("");
  const [newAdminAddress, setNewAdminAddress] = useState<string>("");
  const [adminCaps, setAdminCaps] = useState<string[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  useEffect(() => {
    fetchRegistry();
    fetchAdminCaps();
  }, [account]);

  const fetchRegistry = async () => {
    if (!account) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const registryObject = await client.getObject({
        id: REGISTRY,
        options: { showContent: true },
      });

      if (registryObject.data?.content?.dataType === "moveObject") {
        const fields = registryObject.data.content.fields as any;
        
        setRegistry({
          id: REGISTRY,
          campaign_count: fields.campaign_count?.toString() || "0",
          total_campaigns_created: fields.total_campaigns_created?.toString() || "0",
          treasury_address: fields.treasury_address || "",
          is_paused: fields.is_paused === true || fields.is_paused === "true" || fields.is_paused === 1,
        });
      }
    } catch (err: any) {
      console.error("Error fetching registry:", err);
      setError("Failed to load registry data");
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminCaps = async () => {
    if (!account) {
      return;
    }

    try {
      setLoadingAdmins(true);
      // Get all AdminCap objects owned by the current user
      const caps = await getAdminCaps(client, account.address);
      setAdminCaps(caps);
    } catch (err: any) {
      console.error("Error fetching admin caps:", err);
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleTogglePause = async () => {
    if (!account) {
      setError(ERROR_MESSAGES.NO_WALLET);
      return;
    }

    setUpdating(true);
    setError("");
    setSuccess("");
    setTxDigest("");

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${PACKAGE_ID}::campaign::toggle_pause`,
        arguments: [
          tx.object(ADMIN_CAP),
          tx.object(REGISTRY),
        ],
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
              setSuccess(`System ${registry?.is_paused ? "resumed" : "paused"} successfully!`);
              await fetchRegistry();
              setNewTreasuryAddress("");
            } catch (confirmError) {
              console.error("Confirmation error:", confirmError);
            }
            
            setUpdating(false);
          },
          onError: (error) => {
            console.error("Transaction error:", error);
            setError(error.message || ERROR_MESSAGES.TRANSACTION_FAILED);
            setUpdating(false);
          },
        }
      );
    } catch (err: any) {
      console.error("Error toggling pause:", err);
      setError(err.message || ERROR_MESSAGES.TRANSACTION_FAILED);
      setUpdating(false);
    }
  };

  const handleUpdateTreasury = async () => {
    if (!account) {
      setError(ERROR_MESSAGES.NO_WALLET);
      return;
    }

    if (!newTreasuryAddress.trim()) {
      setError("Please enter a valid treasury address");
      return;
    }

    // Basic address validation (Sui addresses start with 0x and are 66 chars)
    if (!newTreasuryAddress.startsWith("0x") || newTreasuryAddress.length !== 66) {
      setError("Invalid Sui address format. Must start with 0x and be 66 characters long.");
      return;
    }

    setUpdating(true);
    setError("");
    setSuccess("");
    setTxDigest("");

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${PACKAGE_ID}::campaign::update_treasury_address`,
        arguments: [
          tx.object(ADMIN_CAP),
          tx.object(REGISTRY),
          tx.pure(newTreasuryAddress.trim()), // Address as string - SDK will serialize
        ],
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
              setSuccess("Treasury address updated successfully!");
              await fetchRegistry();
              setNewTreasuryAddress("");
            } catch (confirmError) {
              console.error("Confirmation error:", confirmError);
            }
            
            setUpdating(false);
          },
          onError: (error) => {
            console.error("Transaction error:", error);
            setError(error.message || ERROR_MESSAGES.TRANSACTION_FAILED);
            setUpdating(false);
          },
        }
      );
    } catch (err: any) {
      console.error("Error updating treasury:", err);
      setError(err.message || ERROR_MESSAGES.TRANSACTION_FAILED);
      setUpdating(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!account) {
      setError(ERROR_MESSAGES.NO_WALLET);
      return;
    }

    if (!newAdminAddress.trim()) {
      setError("Please enter a valid admin address");
      return;
    }

    // Basic address validation (Sui addresses start with 0x and are 66 chars)
    if (!newAdminAddress.startsWith("0x") || newAdminAddress.length !== 66) {
      setError("Invalid Sui address format. Must start with 0x and be 66 characters long.");
      return;
    }

    // Get the first AdminCap owned by the current user
    if (adminCaps.length === 0) {
      setError("You don't have an AdminCap. Cannot add new admins.");
      return;
    }

    setUpdating(true);
    setError("");
    setSuccess("");
    setTxDigest("");

    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${PACKAGE_ID}::campaign::add_admin`,
        arguments: [
          tx.object(adminCaps[0]), // Use the first AdminCap owned by the user
          tx.pure(newAdminAddress.trim()),
        ],
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
              setSuccess(`Admin added successfully! New admin: ${shortenAddress(newAdminAddress.trim(), 8)}`);
              setNewAdminAddress("");
              // Refresh admin caps list
              await fetchAdminCaps();
            } catch (confirmError) {
              console.error("Confirmation error:", confirmError);
            }
            
            setUpdating(false);
          },
          onError: (error) => {
            console.error("Transaction error:", error);
            setError(error.message || ERROR_MESSAGES.TRANSACTION_FAILED);
            setUpdating(false);
          },
        }
      );
    } catch (err: any) {
      console.error("Error adding admin:", err);
      setError(err.message || ERROR_MESSAGES.TRANSACTION_FAILED);
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-slate-900 dark:text-white mb-2">
          Platform Settings
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Manage global registry state and system configuration
        </p>
      </div>

      {/* System Status Section */}
      <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-slate-900 dark:bg-[#D4AF37]">
            <Settings className="w-5 h-5 text-white dark:text-black" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            System Status
          </h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${registry?.is_paused ? "bg-red-500" : "bg-green-500"}`} />
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Current Status
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {registry?.is_paused ? "System is paused" : "System is active"}
                </p>
              </div>
            </div>
            <span
              className={`px-4 py-2 rounded-full text-sm font-semibold ${
                registry?.is_paused
                  ? "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                  : "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400"
              }`}
            >
              {registry?.is_paused ? "PAUSED" : "ACTIVE"}
            </span>
          </div>

          <button
            onClick={handleTogglePause}
            disabled={updating || !account}
            className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
              registry?.is_paused
                ? "bg-green-600 dark:bg-green-500 text-white hover:opacity-90"
                : "bg-red-600 dark:bg-red-500 text-white hover:opacity-90"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {updating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : registry?.is_paused ? (
              <>
                <Play className="w-5 h-5" />
                Resume System
              </>
            ) : (
              <>
                <Pause className="w-5 h-5" />
                Pause System
              </>
            )}
          </button>

          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <strong>Note:</strong> When paused, minting and yield claiming are disabled. 
              Administrative functions remain available.
            </p>
          </div>
        </div>
      </div>

      {/* Treasury Management Section */}
      <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-blue-500 dark:bg-blue-600">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Treasury Management
          </h2>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Current Treasury Address
            </p>
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-slate-400" />
              <p className="font-mono text-sm text-slate-900 dark:text-white break-all">
                {registry?.treasury_address ? shortenAddress(registry.treasury_address, 12) : "Not set"}
              </p>
            </div>
            {registry?.treasury_address && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                {registry.treasury_address}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              New Treasury Address
            </label>
            <input
              type="text"
              value={newTreasuryAddress}
              onChange={(e) => setNewTreasuryAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-3 rounded-lg bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#D4AF37] focus:border-transparent transition-all font-mono text-sm"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Enter a valid Sui address (0x followed by 64 hex characters)
            </p>
          </div>

          <button
            onClick={handleUpdateTreasury}
            disabled={updating || !account || !newTreasuryAddress.trim()}
            className="w-full py-3 rounded-xl bg-blue-600 dark:bg-blue-500 text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {updating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                Update Treasury Address
              </>
            )}
          </button>

          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30">
            <p className="text-xs text-blue-700 dark:text-blue-400">
              <strong>Warning:</strong> Changing the treasury address will affect all future withdrawals. 
              Ensure the new address is correct and secure.
            </p>
          </div>
        </div>
      </div>

      {/* Admin Management Section */}
      <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-purple-500 dark:bg-purple-600">
            <Users className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Admin Management
          </h2>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Your AdminCap Objects
            </p>
            {loadingAdmins ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                <p className="text-xs text-slate-500 dark:text-slate-400">Loading...</p>
              </div>
            ) : adminCaps.length > 0 ? (
              <div className="space-y-2">
                {adminCaps.map((capId, index) => (
                  <div key={capId} className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-500" />
                    <p className="font-mono text-xs text-slate-900 dark:text-white break-all">
                      {shortenAddress(capId, 12)}
                    </p>
                  </div>
                ))}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  You own {adminCaps.length} AdminCap{adminCaps.length !== 1 ? "s" : ""}. 
                  This grants you admin privileges.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No AdminCap objects found. You need an AdminCap to perform admin actions.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              New Admin Address
            </label>
            <input
              type="text"
              value={newAdminAddress}
              onChange={(e) => setNewAdminAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-3 rounded-lg bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent transition-all font-mono text-sm"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Enter a valid Sui address (0x followed by 64 hex characters). This will mint a new AdminCap and transfer it to the recipient.
            </p>
          </div>

          <button
            onClick={handleAddAdmin}
            disabled={updating || !account || !newAdminAddress.trim() || adminCaps.length === 0}
            className="w-full py-3 rounded-xl bg-purple-600 dark:bg-purple-500 text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {updating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Adding Admin...
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                Add Admin
              </>
            )}
          </button>

          <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/30">
            <p className="text-xs text-purple-700 dark:text-purple-400">
              <strong>Note:</strong> Adding a new admin will mint a new AdminCap object and transfer it to the specified address. 
              The recipient will immediately gain full admin privileges. Only existing admins can add new admins.
            </p>
          </div>
        </div>
      </div>

      {/* Registry Stats */}
      {registry && (
        <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Registry Statistics
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                Total Campaigns Created
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {registry.total_campaigns_created}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                Active Campaigns
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {registry.campaign_count}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
              {success}
            </p>
            {txDigest && (
              <a
                href={`https://suiexplorer.com/txblock/${txDigest}?network=testnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-600 dark:text-green-400 hover:underline font-mono"
              >
                View transaction: {txDigest.slice(0, 20)}...
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

