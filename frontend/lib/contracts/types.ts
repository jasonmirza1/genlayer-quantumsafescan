/**
 * TypeScript types for GenLayer Football Betting contract
 */

export interface Bet {
  id: string;
  game_date: string;
  team1: string;
  team2: string;
  predicted_winner: string;
  has_resolved: boolean;
  real_winner?: string;
  real_score?: string;
  resolution_url?: string;
  owner: string;
}

export interface LeaderboardEntry {
  address: string;
  points: number;
}

export interface TransactionReceipt {
  status: string;
  hash: string;
  blockNumber?: number;
  [key: string]: any;
}

export interface BetFilters {
  resolved?: boolean;
  owner?: string;
}

export interface ScanResult {
  id: string;
  submitted_by: string;
  target_url: string;
  score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  verdict: string;
  evidence_summary: string;
  recommended_fixes: string[];
  block_info: string;
}
