"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Hash,
  Loader2,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { useWallet } from "@/lib/genlayer/wallet";
import { getContractAddress } from "@/lib/genlayer/client";
import {
  useLatestScan,
  useScanCount,
  useSubmitScan,
} from "@/lib/hooks/useQuantumSafeScan";
import type { ScanResult } from "@/lib/contracts/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

const DEFAULT_REPO_URL =
  "https://github.com/jasonmirza1/genlayer-quantumsafescan";

function riskStyles(risk?: ScanResult["risk_level"]) {
  if (risk === "LOW") {
    return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
  }
  if (risk === "HIGH") {
    return "border-red-400/40 bg-red-400/10 text-red-200";
  }
  return "border-yellow-400/40 bg-yellow-400/10 text-yellow-100";
}

export function QuantumSafeScanner() {
  const { address, isConnected, isOnCorrectNetwork } = useWallet();
  const [repoUrl, setRepoUrl] = useState(DEFAULT_REPO_URL);
  const latestScan = useLatestScan(address);
  const scanCount = useScanCount();
  const submitScan = useSubmitScan();
  const contractAddress = getContractAddress();

  const receipt = submitScan.data as any;
  const txHash = receipt?.hash || receipt?.transactionHash || receipt?.txHash;

  const isValidGithubUrl = useMemo(() => {
    return (
      repoUrl.startsWith("https://github.com/") ||
      repoUrl.startsWith("https://www.github.com/")
    );
  }, [repoUrl]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitScan.submitScan({ targetUrl: repoUrl.trim() });
  };

  const scan = latestScan.data;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
      <section className="lg:col-span-7 brand-card p-5 md:p-7 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-accent">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-normal">
              GenLayer Intelligent Contract
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">
            QuantumSafeScan Lite
          </h1>
          <p className="text-muted-foreground">
            AI Security & Quantum Readiness Scanner on GenLayer
          </p>
          <p className="text-sm text-muted-foreground">
            Reviews public repository overview and security-policy evidence.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="repo-url" className="text-sm font-medium">
              Public GitHub repository
            </label>
            <Input
              id="repo-url"
              value={repoUrl}
              onChange={(event) => setRepoUrl(event.target.value)}
              placeholder="https://github.com/owner/repo"
              className="h-12"
            />
          </div>

          {!isValidGithubUrl && repoUrl.length > 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Unsupported URL</AlertTitle>
              <AlertDescription>
                Use an HTTPS GitHub repository URL.
              </AlertDescription>
            </Alert>
          ) : null}

          {isConnected && !isOnCorrectNetwork ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Switch to GenLayer Bradbury</AlertTitle>
              <AlertDescription>
                Change the connected wallet network before running a scan.
              </AlertDescription>
            </Alert>
          ) : null}

          {!contractAddress ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Bradbury contract not configured</AlertTitle>
              <AlertDescription>
                Deploy the contract to Bradbury and set NEXT_PUBLIC_CONTRACT_ADDRESS.
              </AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="submit"
            variant="gradient"
            size="lg"
            className="w-full md:w-auto"
            disabled={
              !isConnected ||
              !isOnCorrectNetwork ||
              !contractAddress ||
              !isValidGithubUrl ||
              submitScan.isSubmitting
            }
          >
            {submitScan.isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ScanLine className="h-4 w-4" />
            )}
            {submitScan.isSubmitting ? "Scanning..." : "Run Scan"}
          </Button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-md border border-white/10 p-4">
            <p className="text-xs text-muted-foreground">Total scans</p>
            <p className="text-2xl font-bold">
              {scanCount.isError ? "Unavailable" : scanCount.data ?? 0}
            </p>
          </div>
          <div className="rounded-md border border-white/10 p-4">
            <p className="text-xs text-muted-foreground">Contract</p>
            <p className="text-sm font-mono break-all">
              {contractAddress || "Not configured"}
            </p>
          </div>
          <div className="rounded-md border border-white/10 p-4">
            <p className="text-xs text-muted-foreground">Last tx</p>
            <p className="text-sm font-mono break-all">
              {txHash || "Pending scan"}
            </p>
          </div>
        </div>
      </section>

      <section className="lg:col-span-5 brand-card p-5 md:p-7 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Latest Result</h2>
            <p className="text-sm text-muted-foreground">
              Stored for the connected wallet
            </p>
          </div>
          <FileSearch className="h-6 w-6 text-accent" />
        </div>

        {latestScan.isError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Contract unavailable</AlertTitle>
            <AlertDescription>
              The configured contract could not be read on GenLayer Bradbury.
            </AlertDescription>
          </Alert>
        ) : latestScan.isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading result...
          </div>
        ) : scan ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Score</p>
                <p className="text-5xl font-bold">{scan.score}</p>
              </div>
              <div
                className={`rounded-md border px-3 py-2 text-sm font-semibold ${riskStyles(
                  scan.risk_level
                )}`}
              >
                {scan.risk_level}
              </div>
            </div>

            <div className="rounded-md border border-white/10 p-4 space-y-2">
              <p className="text-xs text-muted-foreground">Repository</p>
              <a
                href={scan.target_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm break-all text-accent hover:underline"
              >
                {scan.target_url}
              </a>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Verdict</p>
              <p className="text-sm leading-6">{scan.verdict}</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Evidence</p>
              <p className="text-sm leading-6 text-muted-foreground">
                {scan.evidence_summary}
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Recommended fixes</p>
              <div className="space-y-2">
                {scan.recommended_fixes.map((fix) => (
                  <div
                    key={fix}
                    className="flex items-start gap-2 rounded-md border border-white/10 p-3"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span className="text-sm">{fix}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-md border border-white/10 p-3 text-xs text-muted-foreground">
              <Hash className="h-4 w-4 shrink-0" />
              <span className="break-all">{scan.block_info}</span>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-white/10 p-6 text-sm text-muted-foreground">
            No scan has been stored for this wallet yet.
          </div>
        )}
      </section>
    </div>
  );
}
