"use client";

import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { createWalletClient, custom, type WalletClient } from "viem";

// GenLayer Network Configuration (from environment variables with fallbacks)
export const GENLAYER_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID || "4221");
export const GENLAYER_CHAIN_ID_HEX = `0x${GENLAYER_CHAIN_ID.toString(16).toUpperCase()}`;
export const GENLAYER_CHAIN = testnetBradbury;

export const GENLAYER_NETWORK = {
  chainId: GENLAYER_CHAIN_ID_HEX,
  chainName: process.env.NEXT_PUBLIC_GENLAYER_CHAIN_NAME || "GenLayer Bradbury",
  nativeCurrency: {
    name: process.env.NEXT_PUBLIC_GENLAYER_SYMBOL || "GEN",
    symbol: process.env.NEXT_PUBLIC_GENLAYER_SYMBOL || "GEN",
    decimals: 18,
  },
  rpcUrls: [process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://rpc-bradbury.genlayer.com"],
  blockExplorerUrls: [],
};

const ACTIVE_WALLET_PROVIDER_KEY = "active_wallet_provider";
const DIRECT_WALLET_IDS = ["okx", "phantom", "coinbase", "rabby", "trust", "brave"];

// Ethereum provider type from window
export interface EthereumProvider {
  isMetaMask?: boolean;
  isOkxWallet?: boolean;
  isPhantom?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  isTrust?: boolean;
  isBraveWallet?: boolean;
  providers?: EthereumProvider[];
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
}

interface EIP6963ProviderDetail {
  info: {
    uuid: string;
    name: string;
    rdns: string;
    icon?: string;
  };
  provider: EthereumProvider;
}

export interface WalletProviderOption {
  id: string;
  name: string;
  rdns?: string;
  icon?: string;
  provider: EthereumProvider;
  isPreferred?: boolean;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    okxwallet?: EthereumProvider;
    phantom?: {
      ethereum?: EthereumProvider;
    };
    coinbaseWalletExtension?: EthereumProvider;
    rabby?: EthereumProvider;
    trustwallet?: EthereumProvider;
    braveEthereum?: EthereumProvider;
  }
}

const announcedProviders: EIP6963ProviderDetail[] = [];
let providerDiscoveryInitialized = false;
let activeWalletProviderId: string | null = null;

function discoverInjectedProviders(): void {
  if (typeof window === "undefined") return;

  if (!providerDiscoveryInitialized) {
    window.addEventListener(
      "eip6963:announceProvider",
      ((event: CustomEvent<EIP6963ProviderDetail>) => {
        const detail = event.detail;
        if (
          detail?.provider &&
          !announcedProviders.some(
            (candidate) =>
              candidate.info.uuid === detail.info.uuid ||
              candidate.provider === detail.provider
          )
        ) {
          announcedProviders.push(detail);
        }
      }) as EventListener
    );
    providerDiscoveryInitialized = true;
  }

  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

function getStoredWalletProviderId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_WALLET_PROVIDER_KEY);
}

function getProviderName(provider: EthereumProvider, fallback?: string): string {
  if (provider.isOkxWallet) return "OKX Wallet";
  if (provider.isMetaMask) return "MetaMask";
  if (provider.isPhantom) return "Phantom";
  if (provider.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider.isRabby) return "Rabby";
  if (provider.isTrust) return "Trust Wallet";
  if (provider.isBraveWallet) return "Brave Wallet";
  return fallback || "Browser Wallet";
}

function getProviderId(
  provider: EthereumProvider,
  fallbackId: string,
  rdns?: string
): string {
  if (provider.isOkxWallet) return "okx";
  if (provider.isMetaMask) return "metamask";
  if (provider.isPhantom) return "phantom";
  if (provider.isCoinbaseWallet) return "coinbase";
  if (provider.isRabby) return "rabby";
  if (provider.isTrust) return "trust";
  if (provider.isBraveWallet) return "brave";
  return rdns ? `rdns:${rdns}` : fallbackId;
}

function getWalletFingerprint(wallet: WalletProviderOption): string {
  const name = wallet.name.toLowerCase();
  const rdns = wallet.rdns?.toLowerCase() || "";
  const id = wallet.id.toLowerCase();

  if (name.includes("okx") || rdns.includes("okx") || id.includes("okx")) {
    return "okx";
  }
  if (
    name.includes("metamask") ||
    rdns.includes("metamask") ||
    id.includes("metamask")
  ) {
    return "metamask";
  }
  if (
    name.includes("phantom") ||
    rdns.includes("phantom") ||
    id.includes("phantom")
  ) {
    return "phantom";
  }
  if (
    name.includes("coinbase") ||
    rdns.includes("coinbase") ||
    id.includes("coinbase")
  ) {
    return "coinbase";
  }
  if (name.includes("rabby") || rdns.includes("rabby") || id.includes("rabby")) {
    return "rabby";
  }
  if (name.includes("trust") || rdns.includes("trust") || id.includes("trust")) {
    return "trust";
  }
  if (name.includes("brave") || rdns.includes("brave") || id.includes("brave")) {
    return "brave";
  }

  return rdns || name || id;
}

function getWalletCandidateRank(wallet: WalletProviderOption): number {
  if (wallet.id.startsWith("eip6963:")) return 0;
  if (DIRECT_WALLET_IDS.includes(wallet.id)) return 1;
  if (wallet.rdns) return 2;
  return 3;
}

function addWalletCandidate(
  wallets: WalletProviderOption[],
  seenProviders: Set<EthereumProvider>,
  seenWallets: Map<string, WalletProviderOption>,
  candidate: WalletProviderOption | null
): void {
  if (!candidate?.provider?.request || seenProviders.has(candidate.provider)) {
    return;
  }

  const fingerprint = getWalletFingerprint(candidate);
  const existing = seenWallets.get(fingerprint);

  if (existing) {
    if (getWalletCandidateRank(candidate) < getWalletCandidateRank(existing)) {
      const index = wallets.findIndex((wallet) => wallet === existing);
      if (index !== -1) {
        wallets[index] = candidate;
      }
      seenWallets.set(fingerprint, candidate);
    }

    seenProviders.add(candidate.provider);
    return;
  }

  seenProviders.add(candidate.provider);
  seenWallets.set(fingerprint, candidate);
  wallets.push(candidate);
}

function sortWallets(wallets: WalletProviderOption[]): WalletProviderOption[] {
  const priority = (wallet: WalletProviderOption) => {
    const name = wallet.name.toLowerCase();
    const rdns = wallet.rdns?.toLowerCase() || "";
    if (name.includes("okx") || rdns.includes("okx")) return 0;
    if (name.includes("metamask") || rdns.includes("metamask")) return 1;
    if (name.includes("phantom") || rdns.includes("phantom")) return 2;
    return 3;
  };

  return wallets.sort((a, b) => priority(a) - priority(b));
}

export function getAvailableWalletProviders(): WalletProviderOption[] {
  if (typeof window === "undefined") return [];

  discoverInjectedProviders();

  const wallets: WalletProviderOption[] = [];
  const seenProviders = new Set<EthereumProvider>();
  const seenWallets = new Map<string, WalletProviderOption>();

  for (const detail of announcedProviders) {
    const name = getProviderName(detail.provider, detail.info.name);
    addWalletCandidate(wallets, seenProviders, seenWallets, {
      id: `eip6963:${detail.info.uuid}`,
      name,
      rdns: detail.info.rdns,
      icon: detail.info.icon,
      provider: detail.provider,
      isPreferred: name.toLowerCase().includes("okx"),
    });
  }

  const directProviders: Array<{
    id: string;
    name: string;
    provider?: EthereumProvider;
    isPreferred?: boolean;
  }> = [
    {
      id: "okx",
      name: "OKX Wallet",
      provider: window.okxwallet,
      isPreferred: true,
    },
    {
      id: "phantom",
      name: "Phantom",
      provider: window.phantom?.ethereum,
    },
    {
      id: "coinbase",
      name: "Coinbase Wallet",
      provider: window.coinbaseWalletExtension,
    },
    {
      id: "rabby",
      name: "Rabby",
      provider: window.rabby,
    },
    {
      id: "trust",
      name: "Trust Wallet",
      provider: window.trustwallet,
    },
    {
      id: "brave",
      name: "Brave Wallet",
      provider: window.braveEthereum,
    },
  ];

  for (const directProvider of directProviders) {
    if (!directProvider.provider?.request) {
      continue;
    }

    addWalletCandidate(wallets, seenProviders, seenWallets, {
      id: directProvider.id,
      name: directProvider.name,
      provider: directProvider.provider,
      isPreferred: directProvider.isPreferred,
    });
  }

  window.ethereum?.providers?.forEach((provider, index) => {
    const name = getProviderName(provider);
    addWalletCandidate(wallets, seenProviders, seenWallets, {
      id: getProviderId(provider, `injected:${index}`),
      name,
      provider,
      isPreferred: name.toLowerCase().includes("okx"),
    });
  });

  if (window.ethereum?.request) {
    const name = getProviderName(window.ethereum);
    addWalletCandidate(wallets, seenProviders, seenWallets, {
      id: getProviderId(window.ethereum, "window.ethereum"),
      name,
      provider: window.ethereum,
      isPreferred: name.toLowerCase().includes("okx"),
    });
  }

  return sortWallets(wallets);
}

export async function refreshWalletProviders(): Promise<WalletProviderOption[]> {
  discoverInjectedProviders();
  await new Promise((resolve) => setTimeout(resolve, 150));
  return getAvailableWalletProviders();
}

export function getActiveWalletProviderOption(): WalletProviderOption | null {
  const wallets = getAvailableWalletProviders();
  if (wallets.length === 0) {
    return null;
  }

  const preferredId = activeWalletProviderId || getStoredWalletProviderId();
  const selected = preferredId
    ? wallets.find((wallet) => wallet.id === preferredId)
    : null;

  return (
    selected ||
    wallets.find((wallet) => wallet.isPreferred) ||
    wallets[0] ||
    null
  );
}

export function setActiveWalletProvider(
  walletId: string
): WalletProviderOption | null {
  const wallet = getAvailableWalletProviders().find(
    (candidate) => candidate.id === walletId
  );

  if (!wallet) {
    return null;
  }

  activeWalletProviderId = wallet.id;

  if (typeof window !== "undefined") {
    localStorage.setItem(ACTIVE_WALLET_PROVIDER_KEY, wallet.id);
  }

  return wallet;
}

export function getActiveWalletName(): string | null {
  return getActiveWalletProviderOption()?.name || null;
}

/**
 * Get the GenLayer RPC URL from environment variables
 */
export function getStudioUrl(): string {
  return (
    process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://rpc-bradbury.genlayer.com"
  );
}

/**
 * Get the contract address from environment variables
 */
export function getContractAddress(): string {
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!address) {
    // Return empty string during build, error will be shown in UI during runtime
    return "";
  }
  return address;
}

/**
 * Check if an EVM wallet is installed
 */
export function isMetaMaskInstalled(): boolean {
  return getAvailableWalletProviders().length > 0;
}

/**
 * Get the active Ethereum provider
 */
export function getEthereumProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return getActiveWalletProviderOption()?.provider || null;
}

/**
 * Request accounts from the active wallet
 * @returns Array of addresses
 */
export async function requestAccounts(): Promise<string[]> {
  const provider = getEthereumProvider();

  if (!provider) {
    throw new Error("No EVM wallet detected");
  }

  try {
    const accounts = await provider.request({
      method: "eth_requestAccounts",
    });
    return accounts;
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error("User rejected the connection request");
    }
    throw new Error(`Failed to connect wallet: ${error.message}`);
  }
}

/**
 * Get current wallet accounts without requesting permission
 * @returns Array of addresses
 */
export async function getAccounts(): Promise<string[]> {
  const provider = getEthereumProvider();

  if (!provider) {
    return [];
  }

  try {
    const accounts = await provider.request({
      method: "eth_accounts",
    });
    return accounts;
  } catch (error) {
    console.error("Error getting accounts:", error);
    return [];
  }
}

/**
 * Get the current chain ID from the active wallet
 */
export async function getCurrentChainId(): Promise<string | null> {
  const provider = getEthereumProvider();

  if (!provider) {
    return null;
  }

  try {
    const chainId = await provider.request({
      method: "eth_chainId",
    });
    return chainId;
  } catch (error) {
    console.error("Error getting chain ID:", error);
    return null;
  }
}

/**
 * Add GenLayer network to the active wallet
 */
export async function addGenLayerNetwork(): Promise<void> {
  const provider = getEthereumProvider();

  if (!provider) {
    throw new Error("No EVM wallet detected");
  }

  try {
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [GENLAYER_NETWORK],
    });
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error("User rejected adding the network");
    }
    throw new Error(`Failed to add GenLayer network: ${error.message}`);
  }
}

/**
 * Switch to GenLayer network
 */
export async function switchToGenLayerNetwork(): Promise<void> {
  const provider = getEthereumProvider();

  if (!provider) {
    throw new Error("No EVM wallet detected");
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: GENLAYER_CHAIN_ID_HEX }],
    });
  } catch (error: any) {
    // If the chain is not added, add it
    if (error.code === 4902) {
      await addGenLayerNetwork();
    } else if (error.code === 4001) {
      throw new Error("User rejected switching the network");
    } else {
      throw new Error(`Failed to switch network: ${error.message}`);
    }
  }
}

/**
 * Check if we're on the GenLayer network
 */
export async function isOnGenLayerNetwork(): Promise<boolean> {
  const chainId = await getCurrentChainId();

  if (!chainId) {
    return false;
  }

  // Convert both to decimal for comparison
  const currentChainIdDecimal = parseInt(chainId, 16);
  return currentChainIdDecimal === GENLAYER_CHAIN_ID;
}

/**
 * Connect to the active wallet and ensure we're on GenLayer network
 * @returns The connected address
 */
export async function connectMetaMask(): Promise<string> {
  if (!isMetaMaskInstalled()) {
    throw new Error("No EVM wallet detected");
  }

  // Request accounts
  const accounts = await requestAccounts();

  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts found");
  }

  // Check and switch to GenLayer network
  const onCorrectNetwork = await isOnGenLayerNetwork();

  if (!onCorrectNetwork) {
    await switchToGenLayerNetwork();
  }

  return accounts[0];
}

/**
 * Request user to switch the active wallet account
 * Shows the wallet account picker even if already connected
 * Uses wallet_requestPermissions to force account selection dialog
 * @returns The newly selected account address
 */
export async function switchAccount(): Promise<string> {
  const provider = getEthereumProvider();

  if (!provider) {
    throw new Error("No EVM wallet detected");
  }

  try {
    try {
      await provider.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch (error: any) {
      const unsupported =
        error.code === -32601 ||
        error.message?.toLowerCase().includes("unsupported") ||
        error.message?.toLowerCase().includes("not supported");

      if (!unsupported) {
        throw error;
      }

      await provider.request({
        method: "eth_requestAccounts",
      });
    }

    // Get the newly selected account
    const accounts = await provider.request({
      method: "eth_accounts",
    });

    if (!accounts || accounts.length === 0) {
      throw new Error("No account selected");
    }

    return accounts[0];
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error("User rejected account switch");
    } else if (error.code === -32002) {
      throw new Error("Account switch request already pending");
    }
    throw new Error(`Failed to switch account: ${error.message}`);
  }
}

/**
 * Create a viem wallet client from the active wallet provider
 */
export function createMetaMaskWalletClient(): WalletClient | null {
  const provider = getEthereumProvider();

  if (!provider) {
    return null;
  }

  try {
    return createWalletClient({
      chain: GENLAYER_CHAIN as any,
      transport: custom(provider),
    });
  } catch (error) {
    console.error("Error creating wallet client:", error);
    return null;
  }
}

/**
 * Create a GenLayer client with active wallet account
 *
 * Note: The genlayer-js SDK doesn't directly support custom transports like viem.
 * When an address is provided, the SDK will use the window.ethereum provider
 * automatically for transaction signing.
 */
export function createGenLayerClient(address?: string) {
  const config: any = {
    chain: GENLAYER_CHAIN,
  };

  if (address) {
    config.account = address as `0x${string}`;
    const provider = getEthereumProvider();
    if (provider) {
      config.provider = provider;
    }
  }

  try {
    return createClient(config);
  } catch (error) {
    console.error("Error creating GenLayer client:", error);
    // Return client without account on error
    return createClient({
      chain: GENLAYER_CHAIN,
    });
  }
}

/**
 * Get a client instance with MetaMask account
 */
export async function getClient() {
  const accounts = await getAccounts();
  const address = accounts[0];
  return createGenLayerClient(address);
}
