"use client";

import { useState } from "react";
import { User, LogOut, AlertCircle, ExternalLink, Wallet, Check } from "lucide-react";
import { useWallet } from "@/lib/genlayer/wallet";
import { error, userRejected } from "@/lib/utils/toast";
import { AddressDisplay } from "./AddressDisplay";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

const WALLET_INSTALL_URL = "https://web3.okx.com/wallet";
const SUPPORTED_EVM_WALLETS = [
  {
    id: "okx",
    match: "okx",
    name: "OKX Wallet",
    url: WALLET_INSTALL_URL,
  },
  {
    id: "metamask",
    match: "metamask",
    name: "MetaMask",
    url: "https://metamask.io/download/",
  },
  {
    id: "phantom",
    match: "phantom",
    name: "Phantom",
    url: "https://phantom.com/download",
  },
  {
    id: "coinbase",
    match: "coinbase",
    name: "Coinbase Wallet",
    url: "https://www.coinbase.com/wallet/downloads",
  },
  {
    id: "rabby",
    match: "rabby",
    name: "Rabby",
    url: "https://rabby.io/",
  },
  {
    id: "trust",
    match: "trust",
    name: "Trust Wallet",
    url: "https://trustwallet.com/browser-extension",
  },
  {
    id: "brave",
    match: "brave",
    name: "Brave Wallet",
    url: "https://brave.com/wallet/",
  },
];

export function AccountPanel() {
  const {
    address,
    isConnected,
    isMetaMaskInstalled,
    isOnCorrectNetwork,
    isLoading,
    availableWallets,
    selectedWalletId,
    walletName,
    connectWallet,
    disconnectWallet,
    switchWalletAccount,
    refreshWallets,
  } = useWallet();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const handleModalOpenChange = (open: boolean) => {
    setIsModalOpen(open);
    if (open) {
      void refreshWallets();
    }
  };

  const handleConnect = async (walletId?: string) => {
    if (!isMetaMaskInstalled) {
      await refreshWallets();
      return;
    }

    try {
      setIsConnecting(true);
      setConnectionError("");
      await connectWallet(walletId);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Failed to connect wallet:", err);
      setConnectionError(err.message || "Failed to connect to wallet");

      if (err.message?.includes("rejected")) {
        userRejected("Connection cancelled");
      } else {
        error("Failed to connect wallet", {
          description: err.message || "Check your wallet extension and try again."
        });
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const detectedWalletLabels = availableWallets.map((wallet) =>
    `${wallet.id} ${wallet.name} ${wallet.rdns ?? ""}`.toLowerCase()
  );
  const undetectedWallets = SUPPORTED_EVM_WALLETS.filter(
    (supportedWallet) =>
      !detectedWalletLabels.some((label) =>
        label.includes(supportedWallet.match)
      )
  );

  const walletOptions = (
    <div className="space-y-2">
      {availableWallets.map((wallet) => {
        const selected = wallet.id === selectedWalletId;

        return (
          <Button
            key={wallet.id}
            onClick={() => handleConnect(wallet.id)}
            variant={selected ? "gradient" : "outline"}
            className="w-full h-14 justify-start gap-3 text-base"
            disabled={isConnecting}
          >
            <Wallet className="w-5 h-5 shrink-0" />
            <span className="flex-1 text-left truncate">{wallet.name}</span>
            {selected && <Check className="w-4 h-4 shrink-0" />}
          </Button>
        );
      })}
    </div>
  );

  const supportedWalletOptions = undetectedWallets.length > 0 && (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Other supported EVM wallets</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {undetectedWallets.map((wallet) => (
          <Button
            key={wallet.id}
            onClick={() => window.open(wallet.url, "_blank")}
            variant="outline"
            className="h-12 justify-start gap-2"
          >
            <ExternalLink className="w-4 h-4 shrink-0" />
            <span className="truncate">{wallet.name}</span>
          </Button>
        ))}
      </div>
    </div>
  );

  const handleDisconnect = () => {
    disconnectWallet();
    setIsModalOpen(false);
  };

  const handleSwitchAccount = async () => {
    try {
      setIsSwitching(true);
      setConnectionError("");
      await switchWalletAccount();
      // Keep modal open to show new account info
    } catch (err: any) {
      console.error("Failed to switch account:", err);

      // Don't show error if user cancelled
      if (!err.message?.includes("rejected")) {
        setConnectionError(err.message || "Failed to switch account");
        error("Failed to switch account", {
          description: err.message || "Please try again."
        });
      } else {
        userRejected("Account switch cancelled");
      }
    } finally {
      setIsSwitching(false);
    }
  };

  // Not connected state
  if (!isConnected) {
    return (
      <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
        <DialogTrigger asChild>
          <Button variant="gradient" disabled={isLoading}>
            <User className="w-4 h-4 mr-2" />
            Connect Wallet
          </Button>
        </DialogTrigger>
        <DialogContent className="border-2">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              Connect to GenLayer
            </DialogTitle>
            <DialogDescription>
              Connect an EVM wallet to run scans
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {!isMetaMaskInstalled ? (
              <>
                <Alert variant="default" className="bg-accent/10 border-accent/20">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Wallet Not Detected</AlertTitle>
                  <AlertDescription>
                    Install or enable an EVM wallet extension. OKX Wallet is
                    preferred when multiple wallets are available.
                  </AlertDescription>
                </Alert>

                {supportedWalletOptions}

                <div className="p-4 rounded-lg bg-muted/10 border border-muted/20">
                  <p className="text-xs text-muted-foreground">
                    After installing the wallet, refresh this page and click
                    &quot;Connect Wallet&quot; again.
                  </p>
                </div>
              </>
            ) : (
              <>
                {walletOptions}

                {supportedWalletOptions}

                {connectionError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Connection Error</AlertTitle>
                    <AlertDescription>{connectionError}</AlertDescription>
                  </Alert>
                )}

                <div className="p-4 rounded-lg bg-muted/10 border border-muted/20">
                  <p className="text-xs text-muted-foreground">
                    Choose the exact wallet extension you want to sign with.
                  </p>
                  <ol className="text-xs text-muted-foreground list-decimal list-inside mt-2 space-y-1">
                    <li>Connect your wallet to this application</li>
                    <li>Add the GenLayer network to your wallet</li>
                    <li>Switch to the GenLayer network</li>
                  </ol>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Connected state
  return (
    <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
      <div className="flex items-center gap-4">
        <div className="brand-card px-4 py-2 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-accent" />
            <AddressDisplay address={address} maxLength={12} />
          </div>
        </div>

        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <User className="w-4 h-4" />
          </Button>
        </DialogTrigger>
      </div>

      <DialogContent className="border-2">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Wallet Details
          </DialogTitle>
          <DialogDescription>
            Your connected wallet information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="brand-card p-4 space-y-2">
            <p className="text-sm text-muted-foreground">Wallet</p>
            <p className="text-sm">{walletName || "Browser Wallet"}</p>
          </div>

          <div className="brand-card p-4 space-y-2">
            <p className="text-sm text-muted-foreground">Your Address</p>
            <code className="text-sm font-mono break-all">{address}</code>
          </div>

          <div className="brand-card p-4 space-y-2">
            <p className="text-sm text-muted-foreground">Network Status</p>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isOnCorrectNetwork
                    ? "bg-green-500"
                    : "bg-yellow-500 animate-pulse"
                }`}
              />
              <span className="text-sm">
                {isOnCorrectNetwork
                  ? "Connected to GenLayer"
                  : "Wrong Network"}
              </span>
            </div>
          </div>

          {!isOnCorrectNetwork && (
            <Alert variant="default" className="bg-yellow-500/10 border-yellow-500/20">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <AlertTitle>Network Warning</AlertTitle>
              <AlertDescription>
                You&apos;re not on the GenLayer network. Please switch networks in
                your wallet or try reconnecting.
              </AlertDescription>
            </Alert>
          )}

          {connectionError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{connectionError}</AlertDescription>
            </Alert>
          )}

          <div className="mt-6 pt-4 border-t border-white/10 space-y-3">
            {availableWallets.length > 1 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Switch wallet</p>
                {walletOptions}
              </div>
            )}

            <Button
              onClick={handleSwitchAccount}
              variant="outline"
              className="w-full"
              disabled={isSwitching || isLoading}
            >
              <User className="w-4 h-4 mr-2" />
              {isSwitching ? "Switching..." : "Switch Account"}
            </Button>

            <Button
              onClick={handleDisconnect}
              className="w-full text-destructive hover:text-destructive"
              variant="outline"
              disabled={isSwitching || isLoading}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Disconnect Wallet
            </Button>
          </div>

          <div className="p-4 rounded-lg bg-muted/10 border border-muted/20">
            <p className="text-xs text-muted-foreground">
              Use &quot;Switch Account&quot; to select a different wallet
              account. &quot;Disconnect&quot; clears this app&apos;s local
              connection state; site permissions remain managed in your wallet.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
