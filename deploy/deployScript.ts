import { readFileSync } from "fs";
import path from "path";
import {
  TransactionHash,
  TransactionStatus,
  GenLayerClient,
} from "genlayer-js/types";

function stringifyReceipt(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === "bigint" ? item.toString() : item),
    2,
  );
}

function getContractAddress(receipt: any): string | undefined {
  return (
    receipt?.data?.contract_address ||
    receipt?.data?.contractAddress ||
    receipt?.txDataDecoded?.contractAddress ||
    receipt?.contractAddress ||
    receipt?.contract_address
  );
}

export default async function main(client: GenLayerClient<any>) {
  const filePath = path.resolve(process.cwd(), "contracts/quantum_safe_scan.py");

  try {
    const contractCode = new Uint8Array(readFileSync(filePath));

    await client.initializeConsensusSmartContract();

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

    if (
      receipt.status !== 5 &&
      receipt.status !== 6 &&
      receipt.statusName !== "ACCEPTED" &&
      receipt.statusName !== "FINALIZED"
    ) {
      throw new Error(`Deployment failed. Receipt: ${stringifyReceipt(receipt)}`);
    }

    const deployedContractAddress = getContractAddress(receipt);

    if (!deployedContractAddress) {
      console.log(`Deployment receipt: ${stringifyReceipt(receipt)}`);
      throw new Error("Deployment accepted but contract address was not found in receipt");
    }
    console.log(`Contract deployed at address: ${deployedContractAddress}`);
  } catch (error) {
    throw new Error(`Error during deployment:, ${error}`);
  }
}
