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
import { RefreshCw, AlertCircle, Radio } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface StreamInfo {
  name: string;
  subjects: string[];
  retention: string;
  maxConsumers: number;
  maxMsgs: number;
  maxBytes: number;
  storage: string;
  replicas: number;
  messages: number;
  bytes: number;
  consumers: number;
  created: string;
}

const STREAMS_QUERY = `
  query {
    streams {
      name
      subjects
      retention
      maxConsumers
      maxMsgs
      maxBytes
      storage
      replicas
      messages
      bytes
      consumers
      created
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

function formatNumber(n: number): string {
  if (n === -1) return "∞";
  return n.toLocaleString();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function retentionColor(retention: string): string {
  switch (retention.toLowerCase()) {
    case "limits":
      return "bg-blue-500/15 text-blue-400 border-blue-500/20";
    case "interest":
      return "bg-amber-500/15 text-amber-400 border-amber-500/20";
    case "workqueue":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
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

/* ─── Mobile Card View ─── */
function StreamCard({ stream }: { stream: StreamInfo }) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="space-y-3 p-4">
        {/* Name */}
        <div className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold">{stream.name}</span>
        </div>

        {/* Subjects */}
        <div className="flex flex-wrap gap-1">
          {stream.subjects.map((s) => (
            <code
              key={s}
              className="rounded bg-muted/50 px-1.5 py-0.5 text-xs font-mono text-muted-foreground"
            >
              {s}
            </code>
          ))}
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={retentionColor(stream.retention)}>
            {stream.retention}
          </Badge>
          <Badge variant="outline" className={storageColor(stream.storage)}>
            {stream.storage}
          </Badge>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60">
              Messages
            </p>
            <p className="font-mono text-sm font-medium">
              {formatNumber(stream.messages)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60">
              Size
            </p>
            <p className="font-mono text-sm font-medium">
              {formatBytes(stream.bytes)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60">
              Consumers
            </p>
            <p className="font-mono text-sm font-medium">
              {stream.consumers}
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground/60">
          Created {formatDate(stream.created)}
        </p>
      </CardContent>
    </Card>
  );
}

function StreamCardSkeleton() {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="space-y-3 p-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-14" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function StreamsPage() {
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const isMobile = useIsMobile();

  const fetchStreams = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const data = await graphqlRequest<{ streams: StreamInfo[] }>(
        STREAMS_QUERY
      );
      setStreams(data.streams);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load streams");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStreams();
  }, [fetchStreams]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Streams
          </h2>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading..."
              : `${streams.length} stream${streams.length !== 1 ? "s" : ""} found`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchStreams(true)}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
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

      {/* Mobile: Card list / Desktop: Table */}
      {isMobile ? (
        <div className="space-y-3">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <StreamCardSkeleton key={i} />
              ))
            : streams.map((stream) => (
                <StreamCard key={stream.name} stream={stream} />
              ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[200px]">Name</TableHead>
                <TableHead>Subjects</TableHead>
                <TableHead>Retention</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead className="text-right">Messages</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead className="text-right">Consumers</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : streams.map((stream) => (
                    <TableRow
                      key={stream.name}
                      className="group transition-colors"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Radio className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                          <span className="font-medium">{stream.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {stream.subjects.map((s) => (
                            <code
                              key={s}
                              className="rounded bg-muted/50 px-1.5 py-0.5 text-xs font-mono text-muted-foreground"
                            >
                              {s}
                            </code>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={retentionColor(stream.retention)}
                        >
                          {stream.retention}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={storageColor(stream.storage)}
                        >
                          {stream.storage}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatNumber(stream.messages)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatBytes(stream.bytes)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {stream.consumers}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatDate(stream.created)}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && streams.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Radio className="mb-4 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            No streams found
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Create a stream in NATS JetStream to see it here
          </p>
        </div>
      )}
    </div>
  );
}
