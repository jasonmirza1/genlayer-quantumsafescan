import { createClient } from "genlayer-js";
import { GENLAYER_CHAIN } from "../genlayer/client";
import type { ScanResult, TransactionReceipt } from "./types";
import {
  estimateWriteFeePreset,
  feePresetToTransactionFees,
  type FeePresetEstimate,
  type FeePresetLevel,
} from "../genlayer/fees";

function toPlainObject(value: any): any {
  if (value instanceof Map) {
    return Array.from(value.entries()).reduce((obj: Record<string, any>, [key, val]) => {
      obj[String(key)] = toPlainObject(val);
      return obj;
    }, {});
  }

  if (Array.isArray(value)) {
    return value.map(toPlainObject);
  }

  return value;
}

function parseFixes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return value ? [value] : [];
    }
  }

  return [];
}

function normalizeScan(raw: any): ScanResult | null {
  const scan = toPlainObject(raw);
  if (!scan || Object.keys(scan).length === 0) {
    return null;
  }

  return {
    id: String(scan.id ?? ""),
    submitted_by: String(scan.submitted_by ?? ""),
    target_url: String(scan.target_url ?? ""),
    score: Number(scan.score ?? 0),
    risk_level: (scan.risk_level ?? "MEDIUM") as ScanResult["risk_level"],
    verdict: String(scan.verdict ?? ""),
    evidence_summary: String(scan.evidence_summary ?? ""),
    recommended_fixes: parseFixes(scan.recommended_fixes),
    block_info: String(scan.block_info ?? ""),
  };
}

function assertSuccessfulTransaction(receipt: any): void {
  const statusName = receipt?.statusName ?? receipt?.status_name;
  if (statusName && statusName !== "ACCEPTED" && statusName !== "FINALIZED") {
    throw new Error(`Scan transaction ended with status ${statusName}.`);
  }

  const resultName = receipt?.resultName ?? receipt?.result_name;
  if (
    resultName &&
    resultName !== "AGREE" &&
    resultName !== "MAJORITY_AGREE"
  ) {
    throw new Error(`Validators did not accept the scan (${resultName}).`);
  }

  const consensus = receipt?.consensus_data ?? receipt?.consensusData;
  const leaderReceipts = consensus?.leader_receipt ?? consensus?.leaderReceipt ?? [];
  const validators = consensus?.validators ?? [];
  const topLevelResults = [
    receipt?.txExecutionResultName,
    receipt?.executionResultName,
    receipt?.execution_result,
  ].filter((value): value is string => typeof value === "string");
  const leaderResults = [
    ...(Array.isArray(leaderReceipts) ? leaderReceipts : [leaderReceipts]).map(
      (entry: any) =>
        entry?.txExecutionResultName ??
        entry?.executionResultName ??
        entry?.execution_result,
    ),
  ].filter((value): value is string => typeof value === "string");
  const fallbackValidatorResults = [
    ...(Array.isArray(validators) ? validators : []).map(
      (entry: any) =>
        entry?.txExecutionResultName ??
        entry?.executionResultName ??
        entry?.execution_result,
    ),
  ].filter((value): value is string => typeof value === "string");
  const executionResults =
    topLevelResults.length > 0 || leaderResults.length > 0
      ? [...topLevelResults, ...leaderResults]
      : fallbackValidatorResults;

  if (
    executionResults.some(
      (value) => value === "ERROR" || value === "FINISHED_WITH_ERROR",
    )
  ) {
    throw new Error("The scan transaction was accepted but contract execution failed.");
  }
}

class QuantumSafeScan {
  private contractAddress: `0x${string}`;
  private client: any;
  private studioUrl?: string;

  constructor(
    contractAddress: string,
    address?: string | null,
    studioUrl?: string
  ) {
    this.contractAddress = contractAddress as `0x${string}`;
    this.studioUrl = studioUrl;

    const config: any = {
      chain: GENLAYER_CHAIN,
    };

    if (address) {
      config.account = address as `0x${string}`;
    }

    if (studioUrl) {
      config.endpoint = studioUrl;
    }

    this.client = createClient(config);
  }

  updateAccount(address: string): void {
    const config: any = {
      chain: GENLAYER_CHAIN,
      account: address as `0x${string}`,
    };

    if (this.studioUrl) {
      config.endpoint = this.studioUrl;
    }

    this.client = createClient(config);
  }

  async estimateSubmitScanFees(
    targetUrl: string,
    level: FeePresetLevel = "standard"
  ): Promise<FeePresetEstimate | undefined> {
    return estimateWriteFeePreset(
      this.client,
      {
        address: this.contractAddress,
        functionName: "submit_scan",
        args: [targetUrl],
      },
      level
    );
  }

  async submitScan(
    targetUrl: string,
    feePreset?: FeePresetEstimate,
    onSubmitted?: (transactionHash: string) => void
  ): Promise<TransactionReceipt> {
    const fees = feePresetToTransactionFees(feePreset);
    const txHash = await this.client.writeContract({
      address: this.contractAddress,
      functionName: "submit_scan",
      args: [targetUrl],
      value: BigInt(0),
      ...(fees ? { fees } : {}),
    });

    onSubmitted?.(txHash);

    const receipt = await this.client.waitForTransactionReceipt({
      hash: txHash,
      status: "ACCEPTED" as any,
      retries: 120,
      interval: 5000,
    });

    assertSuccessfulTransaction(receipt);
    return receipt as TransactionReceipt;
  }

  async getLatestScan(address: string | null): Promise<ScanResult | null> {
    if (!address) {
      return null;
    }

    const scanCount = await this.getScanCount();
    const oldestScanId = Math.max(1, scanCount - 49);

    for (let scanId = scanCount; scanId >= oldestScanId; scanId -= 1) {
      const scan = normalizeScan(
        await this.client.readContract({
          address: this.contractAddress,
          functionName: "get_scan",
          args: [String(scanId)],
        })
      );

      if (scan?.submitted_by.toLowerCase() === address.toLowerCase()) {
        return scan;
      }
    }

    return null;
  }

  async getScanCount(): Promise<number> {
    const count = await this.client.readContract({
      address: this.contractAddress,
      functionName: "get_scan_count",
      args: [],
    });

    return Number(count) || 0;
  }
}

export default QuantumSafeScan;
