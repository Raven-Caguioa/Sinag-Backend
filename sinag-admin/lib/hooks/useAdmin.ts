// lib/hooks/useAdmin.ts
// React hook for checking admin status via AdminCap ownership

import { useEffect, useState } from "react";
import { useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import { isAdminOnChain } from "../admins";

/**
 * Hook to check if the current connected wallet owns an AdminCap
 */
export function useAdmin(): {
  isAdmin: boolean;
  loading: boolean;
} {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!account?.address) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const adminStatus = await isAdminOnChain(client, account.address);
        setIsAdmin(adminStatus);
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [client, account?.address]);

  return { isAdmin, loading };
}

