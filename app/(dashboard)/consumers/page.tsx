"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  Pause,
  Play,
  Users,
  Radio,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

/* ─── Types ─── */
interface StreamInfo {
  name: string;
  subjects: string[];
  consumers: number;
}

interface ConsumerInfo {
  name: string;
  stream: string;
  deliverPolicy: string;
  ackPolicy: string;
  maxDeliver: number;
  maxAckPending: number;
  numPending: number;
  numAckPending: number;
  paused: boolean;
  filterSubject: string;
  description: string;
}

/* ─── GraphQL ─── */
const STREAMS_QUERY = `
  query {
    streams {
      name
      subjects
      consumers
    }
  }
`;

const CONSUMERS_QUERY = `
  query($stream: String!) {
    consumers(stream: $stream) {
      name
      stream
      deliverPolicy
      ackPolicy
      numPending
      numAckPending
      paused
    }
  }
`;

const CONSUMER_INFO_QUERY = `
  query($stream: String!, $name: String!) {
    consumerInfo(stream: $stream, name: $name) {
      name
      stream
      deliverPolicy
      ackPolicy
      maxDeliver
      maxAckPending
      numPending
      numAckPending
      paused
    }
  }
`;

const CONSUMER_CREATE_MUTATION = `
  mutation(
    $stream: String!
    $name: String!
    $filterSubject: String
    $deliverPolicy: String
    $ackPolicy: String
    $maxDeliver: Int
    $description: String
  ) {
    consumerCreate(
      stream: $stream
      name: $name
      filterSubject: $filterSubject
      deliverPolicy: $deliverPolicy
      ackPolicy: $ackPolicy
      maxDeliver: $maxDeliver
      description: $description
    ) {
      name
      stream
      deliverPolicy
      ackPolicy
      maxDeliver
    }
  }
`;

const CONSUMER_DELETE_MUTATION = `
  mutation($stream: String!, $name: String!) {
    consumerDelete(stream: $stream, name: $name)
  }
`;

const CONSUMER_PAUSE_MUTATION = `
  mutation($stream: String!, $name: String!, $pauseUntil: String!) {
    consumerPause(stream: $stream, name: $name, pauseUntil: $pauseUntil)
  }
`;

const CONSUMER_RESUME_MUTATION = `
  mutation($stream: String!, $name: String!) {
    consumerResume(stream: $stream, name: $name)
  }
`;

/* ─── Helpers ─── */
function deliverPolicyColor(policy: string): string {
  switch (policy.toLowerCase()) {
    case "all":
      return "bg-blue-500/15 text-blue-400 border-blue-500/20";
    case "new":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
    case "last":
      return "bg-amber-500/15 text-amber-400 border-amber-500/20";
    case "bystarttimesequence":
    case "by_start_sequence":
      return "bg-purple-500/15 text-purple-400 border-purple-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function ackPolicyColor(policy: string): string {
  switch (policy.toLowerCase()) {
    case "explicit":
      return "bg-rose-500/15 text-rose-400 border-rose-500/20";
    case "none":
      return "bg-cyan-500/15 text-cyan-400 border-cyan-500/20";
    case "all":
      return "bg-indigo-500/15 text-indigo-400 border-indigo-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatNumber(n: number): string {
  if (n === -1) return "∞";
  return n.toLocaleString();
}

/* ─── Create Consumer Dialog ─── */
function CreateConsumerDialog({
  stream,
  onCreated,
}: {
  stream: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [deliverPolicy, setDeliverPolicy] = useState("all");
  const [ackPolicy, setAckPolicy] = useState("explicit");
  const [maxDeliver, setMaxDeliver] = useState("-1");
  const [description, setDescription] = useState("");

  const resetForm = () => {
    setName("");
    setFilterSubject("");
    setDeliverPolicy("all");
    setAckPolicy("explicit");
    setMaxDeliver("-1");
    setDescription("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Consumer name is required");
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const variables: Record<string, unknown> = {
        stream,
        name: name.trim(),
        deliverPolicy,
        ackPolicy,
        maxDeliver: parseInt(maxDeliver),
      };
      if (filterSubject.trim()) {
        variables.filterSubject = filterSubject.trim();
      }
      if (description.trim()) {
        variables.description = description.trim();
      }

      await graphqlRequest(CONSUMER_CREATE_MUTATION, variables);

      setOpen(false);
      resetForm();
      onCreated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create consumer"
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Create Consumer</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Consumer</DialogTitle>
            <DialogDescription>
              Create a new consumer on{" "}
              <code className="rounded bg-muted/50 px-1.5 py-0.5 text-xs font-mono">
                {stream}
              </code>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="consumer-name">Consumer Name</Label>
              <Input
                id="consumer-name"
                placeholder="my-consumer"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={creating}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="consumer-description">Description</Label>
              <Input
                id="consumer-description"
                placeholder="Optional description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={creating}
              />
            </div>

            {/* Filter Subject */}
            <div className="grid gap-2">
              <Label htmlFor="consumer-filter">Filter Subject</Label>
              <Input
                id="consumer-filter"
                placeholder="orders.> (optional)"
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                disabled={creating}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Only deliver messages matching this subject
              </p>
            </div>

            {/* Deliver Policy & Ack Policy */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Deliver Policy</Label>
                <Select
                  value={deliverPolicy}
                  onValueChange={setDeliverPolicy}
                  disabled={creating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="last">Last</SelectItem>
                    <SelectItem value="last_per_subject">
                      Last Per Subject
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Ack Policy</Label>
                <Select
                  value={ackPolicy}
                  onValueChange={setAckPolicy}
                  disabled={creating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="explicit">Explicit</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Max Deliver */}
            <div className="grid gap-2">
              <Label htmlFor="consumer-max-deliver">Max Deliver</Label>
              <Input
                id="consumer-max-deliver"
                type="number"
                min="-1"
                value={maxDeliver}
                onChange={(e) => setMaxDeliver(e.target.value)}
                disabled={creating}
              />
              <p className="text-xs text-muted-foreground">
                Max delivery attempts. -1 for unlimited.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={creating} className="gap-2">
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Pause Dialog ─── */
function PauseConsumerDialog({
  stream,
  consumerName,
  open,
  onOpenChange,
  onPaused,
}: {
  stream: string;
  consumerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaused: () => void;
}) {
  const [pausing, setPausing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState("60");
  const [unit, setUnit] = useState("minutes");

  const handlePause = async () => {
    try {
      setPausing(true);
      setError(null);

      const durationNum = parseInt(duration) || 60;
      let seconds = durationNum;
      if (unit === "minutes") seconds = durationNum * 60;
      else if (unit === "hours") seconds = durationNum * 3600;
      else if (unit === "days") seconds = durationNum * 86400;

      const pauseUntil = new Date(Date.now() + seconds * 1000).toISOString();

      await graphqlRequest(CONSUMER_PAUSE_MUTATION, {
        stream,
        name: consumerName,
        pauseUntil,
      });

      onOpenChange(false);
      onPaused();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to pause consumer"
      );
    } finally {
      setPausing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Pause Consumer</DialogTitle>
          <DialogDescription>
            Pause{" "}
            <code className="rounded bg-muted/50 px-1.5 py-0.5 text-xs font-mono">
              {consumerName}
            </code>{" "}
            for a specified duration.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_120px] gap-3 py-4">
          <div className="grid gap-2">
            <Label htmlFor="pause-duration">Duration</Label>
            <Input
              id="pause-duration"
              type="number"
              min="1"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              disabled={pausing}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label>Unit</Label>
            <Select value={unit} onValueChange={setUnit} disabled={pausing}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="seconds">Seconds</SelectItem>
                <SelectItem value="minutes">Minutes</SelectItem>
                <SelectItem value="hours">Hours</SelectItem>
                <SelectItem value="days">Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={handlePause}
            disabled={pausing}
            className="gap-2"
            variant="default"
          >
            {pausing && <Loader2 className="h-4 w-4 animate-spin" />}
            {pausing ? "Pausing..." : "Pause"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Consumer Detail Dialog ─── */
function ConsumerDetailDialog({
  stream,
  consumerName,
  open,
  onOpenChange,
}: {
  stream: string;
  consumerName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [info, setInfo] = useState<ConsumerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!consumerName || !open) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await graphqlRequest<{ consumerInfo: ConsumerInfo }>(
          CONSUMER_INFO_QUERY,
          { stream, name: consumerName }
        );
        setInfo(data.consumerInfo);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load consumer info"
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [stream, consumerName, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {consumerName}
          </DialogTitle>
          <DialogDescription>Consumer details</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {!loading && !error && info && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-1">
                  Deliver Policy
                </p>
                <Badge
                  variant="outline"
                  className={deliverPolicyColor(info.deliverPolicy)}
                >
                  {info.deliverPolicy}
                </Badge>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-1">
                  Ack Policy
                </p>
                <Badge
                  variant="outline"
                  className={ackPolicyColor(info.ackPolicy)}
                >
                  {info.ackPolicy}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-1">
                  Max Deliver
                </p>
                <p className="font-mono text-sm font-medium">
                  {formatNumber(info.maxDeliver)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-1">
                  Max Ack Pending
                </p>
                <p className="font-mono text-sm font-medium">
                  {formatNumber(info.maxAckPending)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-1">
                  Pending
                </p>
                <p className="font-mono text-sm font-medium">
                  {formatNumber(info.numPending)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-1">
                  Ack Pending
                </p>
                <p className="font-mono text-sm font-medium">
                  {formatNumber(info.numAckPending)}
                </p>
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-1">
                Status
              </p>
              <Badge
                variant="outline"
                className={
                  info.paused
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
                    : "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                }
              >
                {info.paused ? "Paused" : "Active"}
              </Badge>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Mobile Card ─── */
function ConsumerCard({
  consumer,
  onViewDetails,
  onDelete,
  onPause,
  onResume,
}: {
  consumer: ConsumerInfo;
  onViewDetails: () => void;
  onDelete: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  return (
    <Card className="border-border/50 bg-card/50 overflow-hidden">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={onViewDetails}
          >
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold">{consumer.name}</span>
          </div>
          <div className="flex items-center gap-1">
            {consumer.paused ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-400"
                onClick={onResume}
                title="Resume"
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-400"
                onClick={onPause}
                title="Pause"
              >
                <Pause className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={deliverPolicyColor(consumer.deliverPolicy)}
          >
            {consumer.deliverPolicy}
          </Badge>
          <Badge
            variant="outline"
            className={ackPolicyColor(consumer.ackPolicy)}
          >
            {consumer.ackPolicy}
          </Badge>
          <Badge
            variant="outline"
            className={
              consumer.paused
                ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
                : "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
            }
          >
            {consumer.paused ? "Paused" : "Active"}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60">
              Pending
            </p>
            <p className="font-mono text-sm font-medium">
              {formatNumber(consumer.numPending)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60">
              Ack Pending
            </p>
            <p className="font-mono text-sm font-medium">
              {formatNumber(consumer.numAckPending)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConsumerCardSkeleton() {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="space-y-3 p-4">
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-14" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Main Page ─── */
export default function ConsumersPage() {
  const [allStreams, setAllStreams] = useState<StreamInfo[]>([]);
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [selectedStream, setSelectedStream] = useState("");
  const [hideKV, setHideKV] = useState(true);

  const [consumers, setConsumers] = useState<ConsumerInfo[]>([]);
  const [loadingConsumers, setLoadingConsumers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [detailConsumer, setDetailConsumer] = useState<string | null>(null);
  const [pauseConsumer, setPauseConsumer] = useState<string | null>(null);

  const isMobile = useIsMobile();

  const streams = useMemo(
    () => (hideKV ? allStreams.filter((s) => !s.name.startsWith("KV_")) : allStreams),
    [allStreams, hideKV]
  );

  /* Load streams */
  useEffect(() => {
    (async () => {
      try {
        setLoadingStreams(true);
        const data = await graphqlRequest<{ streams: StreamInfo[] }>(
          STREAMS_QUERY
        );
        setAllStreams(data.streams);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load streams"
        );
      } finally {
        setLoadingStreams(false);
      }
    })();
  }, []);

  /* Load consumers for selected stream */
  const fetchConsumers = useCallback(
    async (isRefresh = false) => {
      if (!selectedStream) return;
      try {
        if (isRefresh) setRefreshing(true);
        else setLoadingConsumers(true);
        setError(null);

        const data = await graphqlRequest<{ consumers: ConsumerInfo[] }>(
          CONSUMERS_QUERY,
          { stream: selectedStream }
        );
        setConsumers(data.consumers);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load consumers"
        );
      } finally {
        setLoadingConsumers(false);
        setRefreshing(false);
      }
    },
    [selectedStream]
  );

  useEffect(() => {
    if (selectedStream) {
      fetchConsumers();
    } else {
      setConsumers([]);
    }
  }, [selectedStream, fetchConsumers]);

  /* Actions */
  const handleDeleteConsumer = async (name: string) => {
    if (
      !window.confirm(
        `Delete consumer "${name}"? This action cannot be undone.`
      )
    )
      return;
    try {
      await graphqlRequest(CONSUMER_DELETE_MUTATION, {
        stream: selectedStream,
        name,
      });
      fetchConsumers(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete consumer"
      );
    }
  };

  const handleResumeConsumer = async (name: string) => {
    try {
      await graphqlRequest(CONSUMER_RESUME_MUTATION, {
        stream: selectedStream,
        name,
      });
      fetchConsumers(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to resume consumer"
      );
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Consumers
          </h2>
          <p className="text-sm text-muted-foreground">
            {!selectedStream
              ? "Select a stream to manage consumers"
              : loadingConsumers
                ? "Loading..."
                : `${consumers.length} consumer${consumers.length !== 1 ? "s" : ""} on ${selectedStream}`}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {selectedStream && (
            <CreateConsumerDialog
              stream={selectedStream}
              onCreated={() => fetchConsumers(true)}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchConsumers(true)}
            disabled={refreshing || !selectedStream}
            className="gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Stream Selector */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-end gap-4 flex-wrap">
          <div className="grid gap-2 flex-1 min-w-[200px] max-w-md">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground/70">
              Stream
            </Label>
            <Select
              value={selectedStream}
              onValueChange={setSelectedStream}
              disabled={loadingStreams}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a stream..." />
              </SelectTrigger>
              <SelectContent>
                {streams.map((s) => (
                  <SelectItem key={s.name} value={s.name}>
                    <div className="flex items-center gap-2">
                      <Radio className="h-3 w-3 text-muted-foreground" />
                      <span>{s.name}</span>
                      <span className="text-xs text-muted-foreground/60 ml-auto">
                        {s.consumers} consumers
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer select-none pb-0.5">
            <Checkbox
              checked={hideKV}
              onCheckedChange={(v) => setHideKV(v === true)}
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">Hide KV</span>
          </label>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 sm:p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Detail Dialog */}
      {selectedStream && (
        <ConsumerDetailDialog
          stream={selectedStream}
          consumerName={detailConsumer}
          open={detailConsumer !== null}
          onOpenChange={(open) => {
            if (!open) setDetailConsumer(null);
          }}
        />
      )}

      {/* Pause Dialog */}
      {selectedStream && pauseConsumer && (
        <PauseConsumerDialog
          stream={selectedStream}
          consumerName={pauseConsumer}
          open={pauseConsumer !== null}
          onOpenChange={(open) => {
            if (!open) setPauseConsumer(null);
          }}
          onPaused={() => fetchConsumers(true)}
        />
      )}

      {/* Content */}
      {selectedStream && (
        <>
          {isMobile ? (
            <div className="space-y-3">
              {loadingConsumers
                ? Array.from({ length: 3 }).map((_, i) => (
                    <ConsumerCardSkeleton key={i} />
                  ))
                : consumers.map((consumer) => (
                    <ConsumerCard
                      key={consumer.name}
                      consumer={consumer}
                      onViewDetails={() => setDetailConsumer(consumer.name)}
                      onDelete={() => handleDeleteConsumer(consumer.name)}
                      onPause={() => setPauseConsumer(consumer.name)}
                      onResume={() => handleResumeConsumer(consumer.name)}
                    />
                  ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[200px]">Name</TableHead>
                    <TableHead>Deliver Policy</TableHead>
                    <TableHead>Ack Policy</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Ack Pending</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingConsumers
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 7 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-5 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    : consumers.map((consumer) => (
                        <TableRow
                          key={consumer.name}
                          className="group transition-colors cursor-pointer"
                          onClick={() => setDetailConsumer(consumer.name)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Users className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                              <span className="font-medium">
                                {consumer.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={deliverPolicyColor(
                                consumer.deliverPolicy
                              )}
                            >
                              {consumer.deliverPolicy}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={ackPolicyColor(consumer.ackPolicy)}
                            >
                              {consumer.ackPolicy}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatNumber(consumer.numPending)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatNumber(consumer.numAckPending)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                consumer.paused
                                  ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
                                  : "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                              }
                            >
                              {consumer.paused ? "Paused" : "Active"}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-2">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {consumer.paused ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-emerald-400"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResumeConsumer(consumer.name);
                                  }}
                                  title="Resume"
                                >
                                  <Play className="h-3.5 w-3.5" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-amber-400"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPauseConsumer(consumer.name);
                                  }}
                                  title="Pause"
                                >
                                  <Pause className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteConsumer(consumer.name);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Empty state */}
          {!loadingConsumers && !error && consumers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="mb-4 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                No consumers found
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Create a consumer to start receiving messages
              </p>
            </div>
          )}
        </>
      )}

      {/* No stream selected empty state */}
      {!selectedStream && !loadingStreams && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Radio className="mb-4 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            Select a stream above
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Choose a stream to view and manage its consumers
          </p>
        </div>
      )}
    </div>
  );
}
