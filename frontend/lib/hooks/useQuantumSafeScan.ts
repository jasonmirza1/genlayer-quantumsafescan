"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QuantumSafeScan from "../contracts/QuantumSafeScan";
import type { ScanResult } from "../contracts/types";
import { getContractAddress, getStudioUrl } from "../genlayer/client";
import { useWallet } from "../genlayer/wallet";
import type { FeePresetLevel } from "../genlayer/fees";
import { configError, error, success } from "../utils/toast";

export function useQuantumSafeScanContract(): QuantumSafeScan | null {
  const { address } = useWallet();
  const contractAddress = getContractAddress();
  const studioUrl = getStudioUrl();

  return useMemo(() => {
    if (!contractAddress) {
      configError(
        "Setup Required",
        "Set NEXT_PUBLIC_CONTRACT_ADDRESS in frontend/.env after deployment."
      );
      return null;
    }

    return new QuantumSafeScan(contractAddress, address, studioUrl);
  }, [contractAddress, address, studioUrl]);
}

export function useLatestScan(address: string | null) {
  const contract = useQuantumSafeScanContract();

  return useQuery<ScanResult | null, Error>({
    queryKey: ["latestScan", address],
    queryFn: () => {
      if (!contract || !address) {
        return Promise.resolve(null);
      }
      return contract.getLatestScan(address);
    },
    enabled: !!contract && !!address,
    refetchOnWindowFocus: true,
    refetchInterval: address ? 10000 : false,
    staleTime: 2000,
  });
}

export function useScanCount() {
  const contract = useQuantumSafeScanContract();

  return useQuery<number, Error>({
    queryKey: ["scanCount"],
    queryFn: () => {
      if (!contract) {
        return Promise.resolve(0);
      }
      return contract.getScanCount();
    },
    enabled: !!contract,
    refetchOnWindowFocus: true,
    staleTime: 2000,
  });
}

export function useSubmitScan() {
  const contract = useQuantumSafeScanContract();
  const { address } = useWallet();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async ({
      targetUrl,
      feePresetLevel,
    }: {
      targetUrl: string;
      feePresetLevel?: FeePresetLevel;
    }) => {
      if (!contract) {
        throw new Error(
          "Contract not configured. Set NEXT_PUBLIC_CONTRACT_ADDRESS in frontend/.env."
        );
      }
      if (!address) {
        throw new Error("Connect your wallet before running a scan.");
      }

      setIsSubmitting(true);
      setTransactionHash(null);
      const feePreset = await contract.estimateSubmitScanFees(
        targetUrl,
        feePresetLevel ?? "standard"
      );
      return contract.submitScan(targetUrl, feePreset, setTransactionHash);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["latestScan"] });
      queryClient.invalidateQueries({ queryKey: ["scanCount"] });
      setIsSubmitting(false);
      success("Scan recorded", {
        description: "GenLayer accepted the scan transaction.",
      });
    },
    onError: (err: any) => {
      setIsSubmitting(false);
      error("Scan failed", {
        description: err?.message || "Check the repo URL and try again.",
      });
    },
  });

  return {
    ...mutation,
    isSubmitting,
    transactionHash,
    submitScan: mutation.mutate,
    submitScanAsync: mutation.mutateAsync,
  };
}
