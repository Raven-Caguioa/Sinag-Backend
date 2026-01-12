// lib/admins.ts
// Admin authentication via on-chain AdminCap ownership

import { SuiClient } from "@mysten/sui.js/client";
import { ADMIN_CAP_TYPE } from "./constants";

/**
 * Check if a given address owns an AdminCap object on-chain
 * This is the new way to verify admin status - anyone who owns an AdminCap
 * is considered an admin.
 */
export async function isAdminOnChain(
  client: SuiClient,
  address: string | null | undefined
): Promise<boolean> {
  if (!address) return false;

  try {
    const ownedObjects = await client.getOwnedObjects({
      owner: address,
      filter: { StructType: ADMIN_CAP_TYPE },
      options: { showContent: false },
    });

    return ownedObjects.data.length > 0;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

/**
 * Legacy synchronous check - kept for backward compatibility
 * This now always returns false as we've moved to on-chain verification.
 * Use isAdminOnChain() instead.
 * 
 * @deprecated Use isAdminOnChain() instead
 */
export function isAdmin(address: string | null | undefined): boolean {
  // Legacy function - always returns false now
  // Components should use the async isAdminOnChain() or a React hook
  return false;
}

/**
 * Get all AdminCap objects owned by an address
 */
export async function getAdminCaps(
  client: SuiClient,
  address: string | null | undefined
): Promise<string[]> {
  if (!address) return [];

  try {
    const ownedObjects = await client.getOwnedObjects({
      owner: address,
      filter: { StructType: ADMIN_CAP_TYPE },
      options: { showContent: false },
    });

    return ownedObjects.data
      .map((obj) => obj.data?.objectId)
      .filter((id): id is string => !!id);
  } catch (error) {
    console.error("Error fetching admin caps:", error);
    return [];
  }
}

