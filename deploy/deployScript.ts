import { readFileSync } from "fs";
import path from "path";
import {
  TransactionHash,
  TransactionStatus,
  GenLayerClient,
} from "genlayer-js/types";

function getContractAddress(receipt: any): string | undefined {
  return (
    receipt?.data?.contract_address ||
    receipt?.data?.contractAddress ||
    receipt?.txDataDecoded?.contractAddress ||
    receipt?.contractAddress ||
    receipt?.contract_address
  );
}

function getExecutionResults(receipt: any): string[] {
  const topLevelResults = [
    receipt?.txExecutionResultName,
    receipt?.executionResultName,
    receipt?.execution_result,
  ].filter((value): value is string => typeof value === "string");
  const consensus = receipt?.consensus_data ?? receipt?.consensusData;
  const leaderReceipts = consensus?.leader_receipt ?? consensus?.leaderReceipt ?? [];
  const validators = consensus?.validators ?? [];
  const leaderResults: string[] = [];

  for (const entry of Array.isArray(leaderReceipts)
    ? leaderReceipts
    : [leaderReceipts]) {
    leaderResults.push(
      entry?.txExecutionResultName,
      entry?.executionResultName,
      entry?.execution_result,
    );
  }

  const authoritativeResults = [...topLevelResults, ...leaderResults].filter(
    (value): value is string => typeof value === "string",
  );
  if (authoritativeResults.length > 0) {
    return authoritativeResults;
  }

  return (Array.isArray(validators) ? validators : [])
    .flatMap((entry: any) => [
      entry?.txExecutionResultName,
      entry?.executionResultName,
      entry?.execution_result,
    ])
    .filter((value): value is string => typeof value === "string");
}

function getExecutionError(receipt: any): string {
  const consensus = receipt?.consensus_data ?? receipt?.consensusData;
  const leaderReceipts = consensus?.leader_receipt ?? consensus?.leaderReceipt ?? [];
  const validators = consensus?.validators ?? [];

  for (const entry of [
    ...(Array.isArray(leaderReceipts) ? leaderReceipts : [leaderReceipts]),
    ...(Array.isArray(validators) ? validators : []),
  ]) {
    const stderr = entry?.genvm_result?.stderr;
    if (typeof stderr === "string" && stderr.trim()) {
      return stderr.trim().split("\n").slice(-6).join("\n");
    }
  }

  return "No execution error details were returned.";
}

function assertSuccessfulExecution(receipt: any): void {
  const statusName = receipt?.statusName ?? receipt?.status_name;
  if (statusName !== "ACCEPTED" && statusName !== "FINALIZED") {
    throw new Error(`Deployment reached unsuccessful status: ${statusName ?? "unknown"}`);
  }

  const resultName = receipt?.resultName ?? receipt?.result_name;
  if (
    resultName &&
    resultName !== "AGREE" &&
    resultName !== "MAJORITY_AGREE"
  ) {
    throw new Error(`Deployment consensus failed: ${resultName}`);
  }

  const executionResults = getExecutionResults(receipt);
  const failure = executionResults.find(
    (value) => value === "ERROR" || value === "FINISHED_WITH_ERROR",
  );
  if (failure) {
    throw new Error(
      `Deployment execution failed (${failure}).\n${getExecutionError(receipt)}`,
    );
  }
}

export default async function main(client: GenLayerClient<any>) {
  const filePath = path.resolve(process.cwd(), "contracts/quantum_safe_scan.py");

  try {
    const contractCode = new Uint8Array(readFileSync(filePath));

    const deployTransaction = await client.deployContract({
      code: contractCode,
      args: [],
    });
    console.log(`Deploy transaction hash: ${deployTransaction}`);

    const receipt = await client.waitForTransactionReceipt({
      hash: deployTransaction as TransactionHash,
      status: TransactionStatus.ACCEPTED,
      retries: 200,
    });

    assertSuccessfulExecution(receipt);

    const deployedContractAddress = getContractAddress(receipt);

    if (!deployedContractAddress) {
      throw new Error("Deployment accepted but contract address was not found in receipt");
    }

    const scanCount = await client.readContract({
      address: deployedContractAddress as `0x${string}`,
      functionName: "get_scan_count",
      args: [],
    });

    console.log(`Contract deployed at address: ${deployedContractAddress}`);
    console.log(`Deployment verified with scan count: ${String(scanCount)}`);
  } catch (error) {
    throw new Error(`Error during deployment: ${error}`);
  }
}
