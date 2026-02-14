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
  Radio,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
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

interface StreamMessage {
  sequence: number;
  subject: string;
  data: string;
  published: string;
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

const MESSAGES_QUERY = `
  query($stream: String!, $last: Int!) {
    streamMessages(stream: $stream, last: $last) {
      sequence
      subject
      data
      published
    }
  }
`;

const STREAM_CREATE_MUTATION = `
  mutation(
    $name: String!
    $subjects: [String!]!
    $retention: String
    $storage: String
    $replicas: Int
    $maxConsumers: Int
    $maxMsgs: Int
    $maxBytes: Int
  ) {
    streamCreate(
      name: $name
      subjects: $subjects
      retention: $retention
      storage: $storage
      replicas: $replicas
      maxConsumers: $maxConsumers
      maxMsgs: $maxMsgs
      maxBytes: $maxBytes
    ) {
      name
      subjects
      retention
      storage
      replicas
    }
  }
`;

const STREAM_DELETE_MUTATION = `
  mutation($name: String!) {
    streamDelete(name: $name)
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

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
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

function tryFormatJSON(data: string): { formatted: string; isJSON: boolean } {
  try {
    const parsed = JSON.parse(data);
    return { formatted: JSON.stringify(parsed, null, 2), isJSON: true };
  } catch {
    return { formatted: data, isJSON: false };
  }
}

/* ─── Create Stream Dialog ─── */
function CreateStreamDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [subjects, setSubjects] = useState("");
  const [retention, setRetention] = useState("limits");
  const [storage, setStorage] = useState("file");
  const [replicas, setReplicas] = useState("1");
  const [maxConsumers, setMaxConsumers] = useState("-1");
  const [maxMsgs, setMaxMsgs] = useState("-1");
  const [maxBytes, setMaxBytes] = useState("-1");

  const resetForm = () => {
    setName("");
    setSubjects("");
    setRetention("limits");
    setStorage("file");
    setReplicas("1");
    setMaxConsumers("-1");
    setMaxMsgs("-1");
    setMaxBytes("-1");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Stream name is required");
      return;
    }

    const subjectList = subjects
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (subjectList.length === 0) {
      setError("At least one subject is required");
      return;
    }

    try {
      setCreating(true);
      setError(null);

      await graphqlRequest(STREAM_CREATE_MUTATION, {
        name: name.trim(),
        subjects: subjectList,
        retention,
        storage,
        replicas: parseInt(replicas) || 1,
        maxConsumers: parseInt(maxConsumers),
        maxMsgs: parseInt(maxMsgs),
        maxBytes: parseInt(maxBytes),
      });

      setOpen(false);
      resetForm();
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create stream");
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
          <span className="hidden sm:inline">Create Stream</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Stream</DialogTitle>
            <DialogDescription>
              Create a new NATS JetStream stream.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="stream-name">Stream Name</Label>
              <Input
                id="stream-name"
                placeholder="MY-STREAM"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={creating}
                autoFocus
              />
            </div>

            {/* Subjects */}
            <div className="grid gap-2">
              <Label htmlFor="stream-subjects">Subjects</Label>
              <Input
                id="stream-subjects"
                placeholder="orders.>, payments.*"
                value={subjects}
                onChange={(e) => setSubjects(e.target.value)}
                disabled={creating}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of subjects
              </p>
            </div>

            {/* Retention & Storage */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Retention</Label>
                <Select
                  value={retention}
                  onValueChange={setRetention}
                  disabled={creating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="limits">Limits</SelectItem>
                    <SelectItem value="interest">Interest</SelectItem>
                    <SelectItem value="workqueue">WorkQueue</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Storage</Label>
                <Select
                  value={storage}
                  onValueChange={setStorage}
                  disabled={creating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="file">File</SelectItem>
                    <SelectItem value="memory">Memory</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Replicas */}
            <div className="grid gap-2">
              <Label htmlFor="stream-replicas">Replicas</Label>
              <Input
                id="stream-replicas"
                type="number"
                min="1"
                max="5"
                value={replicas}
                onChange={(e) => setReplicas(e.target.value)}
                disabled={creating}
              />
            </div>

            {/* Limits */}
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="stream-max-consumers">Max Consumers</Label>
                <Input
                  id="stream-max-consumers"
                  type="number"
                  min="-1"
                  value={maxConsumers}
                  onChange={(e) => setMaxConsumers(e.target.value)}
                  disabled={creating}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stream-max-msgs">Max Messages</Label>
                <Input
                  id="stream-max-msgs"
                  type="number"
                  min="-1"
                  value={maxMsgs}
                  onChange={(e) => setMaxMsgs(e.target.value)}
                  disabled={creating}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stream-max-bytes">Max Bytes</Label>
                <Input
                  id="stream-max-bytes"
                  type="number"
                  min="-1"
                  value={maxBytes}
                  onChange={(e) => setMaxBytes(e.target.value)}
                  disabled={creating}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Use -1 for unlimited
            </p>

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

/* ─── Messages Dialog ─── */
function MessagesDialog({
  streamName,
  open,
  onOpenChange,
}: {
  streamName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!streamName || !open) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await graphqlRequest<{
          streamMessages: StreamMessage[];
        }>(MESSAGES_QUERY, { stream: streamName, last: 10 });
        setMessages(data.streamMessages);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load messages"
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [streamName, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            {streamName}
          </DialogTitle>
          <DialogDescription>Last 10 messages</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
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

          {!loading && !error && messages.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground/60">
              No messages in this stream
            </p>
          )}

          {!loading && !error && messages.length > 0 && (
            <div className="divide-y divide-border/20">
              {messages.map((msg) => {
                const { formatted, isJSON } = tryFormatJSON(msg.data);
                return (
                  <div key={msg.sequence} className="px-1 py-3 first:pt-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="font-mono text-xs text-muted-foreground/60">
                        #{msg.sequence}
                      </span>
                      <code className="rounded bg-muted/50 px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                        {msg.subject}
                      </code>
                      <span className="ml-auto text-[11px] text-muted-foreground/50">
                        {formatMessageTime(msg.published)}
                      </span>
                    </div>
                    <pre
                      className={`text-xs rounded-md bg-muted/30 p-2.5 overflow-x-auto font-mono ${
                        isJSON ? "text-emerald-400/80" : "text-foreground/70"
                      }`}
                    >
                      {formatted}
                    </pre>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Mobile Card View ─── */
function StreamCard({
  stream,
  onViewMessages,
  onDelete,
}: {
  stream: StreamInfo;
  onViewMessages: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="border-border/50 bg-card/50 overflow-hidden">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold">{stream.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={onViewMessages}
            >
              Messages
            </Button>
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

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={retentionColor(stream.retention)}
          >
            {stream.retention}
          </Badge>
          <Badge
            variant="outline"
            className={storageColor(stream.storage)}
          >
            {stream.storage}
          </Badge>
        </div>

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
  const [selectedStream, setSelectedStream] = useState<string | null>(null);
  const [hideKV, setHideKV] = useState(true);
  const isMobile = useIsMobile();

  const filteredStreams = useMemo(
    () => (hideKV ? streams.filter((s) => !s.name.startsWith("KV_")) : streams),
    [streams, hideKV]
  );

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

  const handleDeleteStream = async (name: string) => {
    if (!window.confirm(`Delete stream "${name}"? This action cannot be undone.`)) return;
    try {
      await graphqlRequest(STREAM_DELETE_MUTATION, { name });
      fetchStreams(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete stream");
    }
  };

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
              : `${filteredStreams.length} stream${filteredStreams.length !== 1 ? "s" : ""} found`}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <Checkbox
              checked={hideKV}
              onCheckedChange={(v) => setHideKV(v === true)}
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">Hide KV</span>
          </label>
          <CreateStreamDialog onCreated={() => fetchStreams(true)} />
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
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 sm:p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Messages Dialog */}
      <MessagesDialog
        streamName={selectedStream}
        open={selectedStream !== null}
        onOpenChange={(open) => { if (!open) setSelectedStream(null); }}
      />

      {/* Mobile: Card list / Desktop: Table */}
      {isMobile ? (
        <div className="space-y-3">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <StreamCardSkeleton key={i} />
              ))
            : filteredStreams.map((stream) => (
                <StreamCard
                  key={stream.name}
                  stream={stream}
                  onViewMessages={() => setSelectedStream(stream.name)}
                  onDelete={() => handleDeleteStream(stream.name)}
                />
              ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
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
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : filteredStreams.map((stream) => (
                    <TableRow
                      key={stream.name}
                      className="group transition-colors cursor-pointer"
                      onClick={() => setSelectedStream(stream.name)}
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
                      <TableCell className="w-10 px-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteStream(stream.name);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredStreams.length === 0 && (
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
