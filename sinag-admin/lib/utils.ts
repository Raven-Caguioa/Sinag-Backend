// lib/utils.ts
// Utility functions for Sinag Protocol

import { MIST_PER_SUI, MICRO_USDC_PER_USDC } from "./constants";

/**
 * Convert SUI to MIST (smallest unit)
 */
export function suiToMist(sui: number): string {
  return Math.floor(sui * MIST_PER_SUI).toString();
}

/**
 * Convert MIST to SUI
 */
export function mistToSui(mist: string | number): number {
  return Number(mist) / MIST_PER_SUI;
}

/**
 * Convert USDC to micro-USDC (smallest unit)
 */
export function usdcToMicro(usdc: number): string {
  return Math.floor(usdc * MICRO_USDC_PER_USDC).toString();
}

/**
 * Convert micro-USDC to USDC
 */
export function microToUsdc(micro: string | number): number {
  return Number(micro) / MICRO_USDC_PER_USDC;
}

/**
 * Format basis points to percentage
 */
export function bpsToPercent(bps: number): string {
  return (bps / 100).toFixed(2);
}

/**
 * Convert percentage to basis points
 */
export function percentToBps(percent: number): number {
  return Math.floor(percent * 100);
}

/**
 * Format timestamp to readable date
 */
export function formatDate(timestamp: string | number): string {
  const date = new Date(Number(timestamp));
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format timestamp to readable date and time
 */
export function formatDateTime(timestamp: string | number): string {
  const date = new Date(Number(timestamp));
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Calculate days remaining until maturity
 */
export function daysUntilMaturity(maturityDate: string | number): number {
  const now = Date.now();
  const maturity = Number(maturityDate);
  const diff = maturity - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Format large numbers with commas
 */
export function formatNumber(num: number | string): string {
  return Number(num).toLocaleString("en-US");
}

/**
 * Format currency
 */
export function formatCurrency(amount: number, currency: "SUI" | "USDC" = "SUI"): string {
  return `${formatNumber(amount.toFixed(2))} ${currency}`;
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(sold: string | number, total: string | number): number {
  const soldNum = Number(sold);
  const totalNum = Number(total);
  if (totalNum === 0) return 0;
  return Math.round((soldNum / totalNum) * 100);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  if (!url) return true; // Empty is valid (optional field)
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Get status label
 */
export function getStatusLabel(status: number): string {
  switch (status) {
    case 0:
      return "Active";
    case 1:
      return "Completed";
    case 2:
      return "Manually Closed";
    default:
      return "Unknown";
  }
}

/**
 * Get status color class
 */
export function getStatusColor(status: number): string {
  switch (status) {
    case 0:
      return "text-green-600 dark:text-green-400";
    case 1:
      return "text-blue-600 dark:text-blue-400";
    case 2:
      return "text-slate-600 dark:text-slate-400";
    default:
      return "text-slate-400";
  }
}

/**
 * Convert bytes to string array (for Move vector<vector<u8>>)
 */
export function stringArrayToBytes(strings: string[]): number[][] {
  return strings.map((str) => Array.from(new TextEncoder().encode(str)));
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(
  client: any,
  digest: string,
  timeout: number = 30000
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const result = await client.waitForTransactionBlock({
        digest,
        options: { showEffects: true },
      });
      
      if (result.effects?.status?.status === "success") {
        return true;
      }
      
      if (result.effects?.status?.status === "failure") {
        return false;
      }
    } catch (error) {
      // Transaction not yet confirmed, continue waiting
    }
    
    // Wait 1 second before next check
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  
  throw new Error("Transaction confirmation timeout");
}