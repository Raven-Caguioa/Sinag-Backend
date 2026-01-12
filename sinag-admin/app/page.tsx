"use client";

// app/page.tsx
import { useEffect, useState } from "react";
import { useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import { TrendingUp, DollarSign, Activity, Package, AlertTriangle } from "lucide-react";
import { REGISTRY, ADMIN_CAP } from "@/lib/constants";
import { formatNumber, shortenAddress } from "@/lib/utils";

export default function Dashboard() {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const [stats, setStats] = useState({
    totalCampaigns: 0,
    activeCampaigns: 0,
    isAdmin: false,
    isPaused: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!account) {
        setLoading(false);
        return;
      }

      try {
        // Fetch registry data
        const registryObject = await client.getObject({
          id: REGISTRY,
          options: { showContent: true },
        });

        if (registryObject.data?.content?.dataType === "moveObject") {
          const fields = registryObject.data.content.fields as any;
          
          setStats({
            totalCampaigns: parseInt(fields.total_campaigns_created || "0"),
            activeCampaigns: parseInt(fields.campaign_count || "0"),
            isAdmin: false,
            isPaused: fields.is_paused === true || fields.is_paused === "true" || fields.is_paused === 1,
          });
        }

        // Check if user owns admin cap
        const ownedObjects = await client.getOwnedObjects({
          owner: account.address,
          filter: { StructType: `${ADMIN_CAP.split("::")[0]}::campaign::AdminCap` },
        });

        if (ownedObjects.data.length > 0) {
          setStats((prev) => ({ ...prev, isAdmin: true }));
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [client, account]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 dark:border-slate-800 border-t-slate-900 dark:border-t-[#D4AF37]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-slate-900 dark:text-white mb-2">
          Dashboard
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Welcome to Sinag Protocol Admin Panel
        </p>
      </div>

      {/* Pause Banner */}
      {stats.isPaused && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">
              ⚠️ System is currently PAUSED
            </p>
            <p className="text-sm text-red-600 dark:text-red-500">
              Minting and claiming are disabled. Administrative functions remain available.
            </p>
          </div>
        </div>
      )}

      {/* Wallet Info */}
      {account ? (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                Connected Wallet
              </p>
              <p className="font-mono text-sm text-slate-900 dark:text-white">
                {shortenAddress(account.address, 8)}
              </p>
            </div>
            {stats.isAdmin && (
              <span className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-semibold">
                Admin Access
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-xl bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5 text-center">
          <p className="text-slate-500 dark:text-slate-400">
            Please connect your wallet to access the admin panel
          </p>
        </div>
      )}

      {/* Stats Grid */}
      {account && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Campaigns */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/10 border border-blue-200 dark:border-blue-800/30">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-blue-500 dark:bg-blue-600">
                <Package className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                ALL TIME
              </span>
            </div>
            <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mb-1">
              {formatNumber(stats.totalCampaigns)}
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400">
              Total Campaigns
            </p>
          </div>

          {/* Active Campaigns */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/10 border border-green-200 dark:border-green-800/30">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-green-500 dark:bg-green-600">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs text-green-600 dark:text-green-400 font-semibold">
                LIVE NOW
              </span>
            </div>
            <p className="text-3xl font-bold text-green-900 dark:text-green-100 mb-1">
              {formatNumber(stats.activeCampaigns)}
            </p>
            <p className="text-sm text-green-600 dark:text-green-400">
              Active Campaigns
            </p>
          </div>

          {/* Network */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/10 border border-purple-200 dark:border-purple-800/30">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-purple-500 dark:bg-purple-600">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold">
                NETWORK
              </span>
            </div>
            <p className="text-3xl font-bold text-purple-900 dark:text-purple-100 mb-1">
              SUI
            </p>
            <p className="text-sm text-purple-600 dark:text-purple-400">
              Testnet
            </p>
          </div>

          {/* Admin Status */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/20 dark:to-slate-800/10 border border-slate-200 dark:border-slate-800/30">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-slate-500 dark:bg-slate-600">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
                ACCESS
              </span>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-1">
              {stats.isAdmin ? "✓" : "✗"}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {stats.isAdmin ? "Admin Verified" : "No Admin Cap"}
            </p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {account && stats.isAdmin && (
        <div className="p-6 rounded-2xl bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Use the sidebar navigation to manage campaigns, finalize operations, or withdraw funds.
          </p>
        </div>
      )}
    </div>
  );
}