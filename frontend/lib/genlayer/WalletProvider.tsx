"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import {
  connectMetaMask,
  switchAccount,
  getAccounts,
  getCurrentChainId,
  isOnGenLayerNetwork,
  getEthereumProvider,
  GENLAYER_CHAIN_ID,
  getActiveWalletName,
  getActiveWalletProviderOption,
  refreshWalletProviders,
  setActiveWalletProvider,
  type WalletProviderOption,
} from "./client";
import { error, userRejected, warning } from "../utils/toast";

// localStorage key for tracking user's disconnect intent
const DISCONNECT_FLAG = "wallet_disconnected";

export interface WalletState {
  address: string | null;
  chainId: string | null;
  isConnected: boolean;
  isLoading: boolean;
  isMetaMaskInstalled: boolean;
  isOnCorrectNetwork: boolean;
  availableWallets: WalletProviderOption[];
  selectedWalletId: string | null;
  walletName: string | null;
}

interface WalletContextValue extends WalletState {
  connectWallet: (walletId?: string) => Promise<string>;
  disconnectWallet: () => void;
  switchWalletAccount: () => Promise<string>;
  refreshWallets: () => Promise<WalletProviderOption[]>;
}

// Create context with undefined default (will error if used outside Provider)
const WalletContext = createContext<WalletContextValue | undefined>(undefined);

/**
 * WalletProvider component that manages wallet state and provides it to all children
 * This ensures all components share the same wallet state and react to changes
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    address: null,
    chainId: null,
    isConnected: false,
    isLoading: true,
    isMetaMaskInstalled: false,
    isOnCorrectNetwork: false,
    availableWallets: [],
    selectedWalletId: null,
    walletName: null,
  });

  // Check MetaMask installation and load account on mount
  useEffect(() => {
    const initWallet = async () => {
      const wallets = await refreshWalletProviders();
      const activeWallet = getActiveWalletProviderOption();
      const installed = wallets.length > 0;

      if (!installed) {
        setState({
          address: null,
          chainId: null,
          isConnected: false,
          isLoading: false,
          isMetaMaskInstalled: false,
          isOnCorrectNetwork: false,
          availableWallets: [],
          selectedWalletId: null,
          walletName: null,
        });
        return;
      }

      // Check if user intentionally disconnected
      // If they did, don't auto-reconnect even if MetaMask has permissions
      if (typeof window !== "undefined") {
        const wasDisconnected =
          localStorage.getItem(DISCONNECT_FLAG) === "true";

        if (wasDisconnected) {
          // User explicitly disconnected, don't auto-reconnect
          setState({
            address: null,
            chainId: null,
            isConnected: false,
            isLoading: false,
            isMetaMaskInstalled: true,
            isOnCorrectNetwork: false,
            availableWallets: wallets,
            selectedWalletId: activeWallet?.id || null,
            walletName: activeWallet?.name || null,
          });
          return;
        }
      }

      try {
        // Get current accounts (without requesting)
        // This will auto-reconnect if MetaMask has existing permissions
        // and user didn't explicitly disconnect
        const accounts = await getAccounts();
        const chainId = await getCurrentChainId();
        const correctNetwork = await isOnGenLayerNetwork();

        setState({
          address: accounts[0] || null,
          chainId,
          isConnected: accounts.length > 0,
          isLoading: false,
          isMetaMaskInstalled: true,
          isOnCorrectNetwork: correctNetwork,
          availableWallets: wallets,
          selectedWalletId: activeWallet?.id || null,
          walletName: activeWallet?.name || null,
        });
      } catch (error) {
        console.error("Error initializing wallet:", error);
        setState({
          address: null,
          chainId: null,
          isConnected: false,
          isLoading: false,
          isMetaMaskInstalled: true,
          isOnCorrectNetwork: false,
          availableWallets: wallets,
          selectedWalletId: activeWallet?.id || null,
          walletName: activeWallet?.name || null,
        });
      }
    };

    initWallet();
  }, []);

  // Set up MetaMask event listeners (ONCE for entire app)
  useEffect(() => {
    const provider = getEthereumProvider();

    if (!provider?.on || !provider.removeListener) {
      return;
    }

    const addProviderListener = provider.on.bind(provider);
    const removeProviderListener = provider.removeListener.bind(provider);

    const handleAccountsChanged = async (accounts: string[]) => {
      const chainId = await getCurrentChainId();
      const correctNetwork = await isOnGenLayerNetwork();

      // If user connected via MetaMask UI, clear the disconnect flag
      // This allows future auto-reconnects
      if (accounts.length > 0 && typeof window !== "undefined") {
        localStorage.removeItem(DISCONNECT_FLAG);
      }

      setState((prev) => ({
        ...prev,
        address: accounts[0] || null,
        chainId,
        isConnected: accounts.length > 0,
        isOnCorrectNetwork: correctNetwork,
        walletName: getActiveWalletName(),
      }));
    };

    const handleChainChanged = async (chainId: string) => {
      // MetaMask recommends reloading the page on chain change
      // but we'll update state instead for better UX
      const correctNetwork = parseInt(chainId, 16) === GENLAYER_CHAIN_ID;
      const accounts = await getAccounts();

      setState((prev) => ({
        ...prev,
        chainId,
        address: accounts[0] || null,
        isConnected: accounts.length > 0,
        isOnCorrectNetwork: correctNetwork,
        walletName: getActiveWalletName(),
      }));
    };

    const handleDisconnect = () => {
      setState((prev) => ({
        ...prev,
        address: null,
        isConnected: false,
      }));
    };

    // Add event listeners
    addProviderListener("accountsChanged", handleAccountsChanged);
    addProviderListener("chainChanged", handleChainChanged);
    addProviderListener("disconnect", handleDisconnect);

    // Cleanup
    return () => {
      removeProviderListener("accountsChanged", handleAccountsChanged);
      removeProviderListener("chainChanged", handleChainChanged);
      removeProviderListener("disconnect", handleDisconnect);
    };
  }, [state.selectedWalletId]);

  const refreshWallets = useCallback(async () => {
    const wallets = await refreshWalletProviders();
    const activeWallet = getActiveWalletProviderOption();

    setState((prev) => ({
      ...prev,
      availableWallets: wallets,
      selectedWalletId: activeWallet?.id || prev.selectedWalletId,
      walletName: activeWallet?.name || prev.walletName,
      isMetaMaskInstalled: wallets.length > 0,
    }));

    return wallets;
  }, []);

  /**
   * Connect to MetaMask
   */
  const connectWallet = useCallback(async (walletId?: string) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      const wallets = await refreshWalletProviders();
      const selectedWallet = walletId
        ? setActiveWalletProvider(walletId)
        : getActiveWalletProviderOption();

      if (!selectedWallet) {
        throw new Error("No EVM wallet detected");
      }

      const address = await connectMetaMask();
      const chainId = await getCurrentChainId();
      const correctNetwork = await isOnGenLayerNetwork();

      // User is connecting, clear the disconnect flag
      // This allows auto-reconnect on future page loads
      if (typeof window !== "undefined") {
        localStorage.removeItem(DISCONNECT_FLAG);
      }

      setState({
        address,
        chainId,
        isConnected: true,
        isLoading: false,
        isMetaMaskInstalled: true,
        isOnCorrectNetwork: correctNetwork,
        availableWallets: wallets,
        selectedWalletId: selectedWallet.id,
        walletName: selectedWallet.name,
      });

      return address;
    } catch (err: any) {
      console.error("Error connecting wallet:", err);
      setState((prev) => ({ ...prev, isLoading: false }));

      // Handle specific error types with appropriate toasts
      if (err.message?.includes("rejected")) {
        userRejected("Connection cancelled");
      } else if (err.message?.includes("No EVM wallet detected")) {
        error("Wallet not found", {
          description: "Please install or enable an EVM wallet extension.",
          action: {
            label: "Install OKX Wallet",
            onClick: () => window.open("https://web3.okx.com/wallet", "_blank")
          }
        });
      } else {
        error("Failed to connect wallet", {
          description: err.message || "Please check your wallet extension and try again."
        });
      }

      throw err;
    }
  }, []);

  /**
   * Disconnect wallet (clear local state and persist disconnect intent)
   * Sets a flag in localStorage to prevent auto-reconnect on page refresh
   */
  const disconnectWallet = useCallback(() => {
    // Persist user's intent to disconnect
    // This prevents auto-reconnect on page refresh
    if (typeof window !== "undefined") {
      localStorage.setItem(DISCONNECT_FLAG, "true");
    }

    setState((prev) => ({
      ...prev,
      address: null,
      isConnected: false,
    }));
  }, []);

  /**
   * Request user to switch to different MetaMask account
   * Shows MetaMask account picker even if already connected
   */
  const switchWalletAccount = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      // Request account switch via MetaMask picker
      const newAddress = await switchAccount();

      // Get updated state
      const chainId = await getCurrentChainId();
      const correctNetwork = await isOnGenLayerNetwork();

      // Clear disconnect flag - user is actively connecting
      if (typeof window !== "undefined") {
        localStorage.removeItem(DISCONNECT_FLAG);
      }

      // Update state immediately for better UX
      // accountsChanged event will also fire, but that's okay
      setState({
        address: newAddress,
        chainId,
        isConnected: true,
        isLoading: false,
        isMetaMaskInstalled: true,
        isOnCorrectNetwork: correctNetwork,
        availableWallets: state.availableWallets,
        selectedWalletId: state.selectedWalletId,
        walletName: getActiveWalletName(),
      });

      return newAddress;
    } catch (err: any) {
      console.error("Error switching account:", err);
      setState((prev) => ({ ...prev, isLoading: false }));

      // Handle specific error types
      if (err.message?.includes("rejected")) {
        userRejected("Account switch cancelled");
      } else {
        error("Failed to switch account", {
          description: err.message || "Please try again."
        });
      }

      throw err;
    }
  }, [state.availableWallets, state.selectedWalletId]);

  const value: WalletContextValue = {
    ...state,
    connectWallet,
    disconnectWallet,
    switchWalletAccount,
    refreshWallets,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

/**
 * Custom hook to use wallet context
 * Must be used within a WalletProvider
 */
export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
