"use client";

import { useEffect, useState, useCallback } from "react";
import { graphqlRequest } from "@/lib/graphql-client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, AlertCircle, Database } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface KeyValue {
  bucket: string;
  history: number;
  ttl: number;
  storage: string;
  bytes: number;
  values: number;
  isCompressed: boolean;
}

const KV_QUERY = `
  query {
    keyValues {
      bucket
      history
      ttl
      storage
      bytes
      values
      isCompressed
    }
  }
`;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatTTL(seconds: number): string {
  if (seconds === 0) return "No expiry";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function storageColor(storage: string): string {
  switch (storage.toLowerCase()) {
    case "file":
      return "bg-purple-500/15 text-purple-400 border-purple-500/20";
    case "memory":
      return "bg-cyan-500/15 text-cyan-400 border-cyan-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/* ─── Mobile Card ─── */
function KVCard({ kv }: { kv: KeyValue }) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold">{kv.bucket}</span>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className={storageColor(kv.storage)}>
            {kv.storage}
          </Badge>
          {kv.isCompressed && (
            <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
              Compressed
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60">Keys</p>
            <p className="font-mono text-sm font-medium">{kv.values.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60">Size</p>
            <p className="font-mono text-sm font-medium">{formatBytes(kv.bytes)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60">History</p>
            <p className="font-mono text-sm font-medium">{kv.history}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60">TTL</p>
            <p className="font-mono text-sm font-medium">{formatTTL(kv.ttl)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KVCardSkeleton() {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="space-y-3 p-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-16" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function KVPage() {
  const [kvStores, setKvStores] = useState<KeyValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const isMobile = useIsMobile();

  const fetchKV = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const data = await graphqlRequest<{ keyValues: KeyValue[] }>(KV_QUERY);
      setKvStores(data.keyValues);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load KV stores");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchKV();
  }, [fetchKV]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">KV Stores</h2>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading..."
              : `${kvStores.length} store${kvStores.length !== 1 ? "s" : ""} found`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchKV(true)}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 sm:p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Mobile: Cards / Desktop: Table */}
      {isMobile ? (
        <div className="space-y-3">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <KVCardSkeleton key={i} />)
            : kvStores.map((kv) => <KVCard key={kv.bucket} kv={kv} />)}
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[200px]">Bucket</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead className="text-right">Keys</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead className="text-right">History</TableHead>
                <TableHead className="text-right">TTL</TableHead>
                <TableHead className="text-center">Compressed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : kvStores.map((kv) => (
                    <TableRow key={kv.bucket} className="group transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Database className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                          <span className="font-medium">{kv.bucket}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={storageColor(kv.storage)}>
                          {kv.storage}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {kv.values.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatBytes(kv.bytes)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {kv.history}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatTTL(kv.ttl)}
                      </TableCell>
                      <TableCell className="text-center">
                        {kv.isCompressed ? (
                          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
                            Yes
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground/50">No</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && kvStores.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Database className="mb-4 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No KV stores found</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Create a KV bucket in NATS JetStream to see it here
          </p>
        </div>
      )}
    </div>
  );
}
