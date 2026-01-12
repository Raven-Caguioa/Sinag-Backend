// lib/admins.ts
// Configuration file for allowed admin wallet addresses

/**
 * Array of Sui wallet addresses that are authorized to access the admin dashboard.
 * Only addresses in this list will be able to access admin features.
 * 
 * Add admin addresses here in the format: "0x..." (lowercase recommended)
 */
export const ALLOWED_ADMINS: string[] = [
    "0xccceeddc79e52cdd512b569c50223837355a738425169153916e3ee93796645e",
    "0x7a3460760da4de7d58d480d676a1cff58376169df66acb6e6b6da6f0baa699ea",	
  // Example: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
];

/**
 * Check if a given address is an authorized admin
 */
export function isAdmin(address: string | null | undefined): boolean {
  if (!address) return false;
  
  // Normalize address to lowercase for comparison
  const normalizedAddress = address.toLowerCase();
  
  return ALLOWED_ADMINS.some(
    (admin) => admin.toLowerCase() === normalizedAddress
  );
}

