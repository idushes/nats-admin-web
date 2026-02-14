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
  Database,
  Plus,
  Loader2,
  ChevronRight,
  Pencil,
  Trash2,
  Save,
  X,
} from "lucide-react";
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

const KV_CREATE_MUTATION = `
  mutation($bucket: String!, $history: Int, $ttl: Int, $storage: String) {
    kvCreate(bucket: $bucket, history: $history, ttl: $ttl, storage: $storage) {
      bucket
      history
      ttl
      storage
    }
  }
`;

const KV_KEYS_QUERY = `
  query($bucket: String!) {
    kvKeys(bucket: $bucket)
  }
`;

const KV_GET_QUERY = `
  query($bucket: String!, $key: String!) {
    kvGet(bucket: $bucket, key: $key) {
      key
      value
      revision
      created
    }
  }
`;

const KV_PUT_MUTATION = `
  mutation($bucket: String!, $key: String!, $value: String!) {
    kvPut(bucket: $bucket, key: $key, value: $value) {
      key
      value
      revision
      created
    }
  }
`;

const KV_PURGE_MUTATION = `
  mutation($bucket: String!, $key: String!) {
    kvPurge(bucket: $bucket, key: $key)
  }
`;

const KV_DELETE_BUCKET_MUTATION = `
  mutation($bucket: String!) {
    kvDeleteBucket(bucket: $bucket)
  }
`;

interface KVEntry {
  key: string;
  value: string;
  revision: number;
  created: string;
}

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

/* ─── Create KV Dialog ─── */
function CreateKVDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bucket, setBucket] = useState("");
  const [history, setHistory] = useState("1");
  const [ttl, setTtl] = useState("0");
  const [storage, setStorage] = useState("file");

  const resetForm = () => {
    setBucket("");
    setHistory("1");
    setTtl("0");
    setStorage("file");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bucket.trim()) {
      setError("Bucket name is required");
      return;
    }

    try {
      setCreating(true);
      setError(null);

      await graphqlRequest(KV_CREATE_MUTATION, {
        bucket: bucket.trim(),
        history: parseInt(history) || 1,
        ttl: parseInt(ttl) || 0,
        storage,
      });

      setOpen(false);
      resetForm();
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create KV store");
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
          <span className="hidden sm:inline">Create KV</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create KV Store</DialogTitle>
            <DialogDescription>
              Create a new NATS JetStream key-value store.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Bucket Name */}
            <div className="grid gap-2">
              <Label htmlFor="bucket">Bucket Name</Label>
              <Input
                id="bucket"
                placeholder="my-bucket"
                value={bucket}
                onChange={(e) => setBucket(e.target.value)}
                disabled={creating}
                autoFocus
              />
            </div>

            {/* History */}
            <div className="grid gap-2">
              <Label htmlFor="history">History</Label>
              <Input
                id="history"
                type="number"
                min="1"
                max="64"
                value={history}
                onChange={(e) => setHistory(e.target.value)}
                disabled={creating}
              />
              <p className="text-xs text-muted-foreground">
                Number of historical values to keep per key (1–64)
              </p>
            </div>

            {/* TTL */}
            <div className="grid gap-2">
              <Label htmlFor="ttl">TTL (seconds)</Label>
              <Input
                id="ttl"
                type="number"
                min="0"
                value={ttl}
                onChange={(e) => setTtl(e.target.value)}
                disabled={creating}
              />
              <p className="text-xs text-muted-foreground">
                Time-to-live in seconds. 0 = no expiry.
              </p>
            </div>

            {/* Storage */}
            <div className="grid gap-2">
              <Label>Storage Type</Label>
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

/* ─── KV Keys Dialog ─── */
function tryFormatJSON(data: string): { formatted: string; isJSON: boolean } {
  try {
    const parsed = JSON.parse(data);
    return { formatted: JSON.stringify(parsed, null, 2), isJSON: true };
  } catch {
    return { formatted: data, isJSON: false };
  }
}

function formatEntryTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/* Single key row with expandable value */
function KVKeyRow({
  bucket,
  keyName,
  onDeleted,
}: {
  bucket: string;
  keyName: string;
  onDeleted: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [entry, setEntry] = useState<KVEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadValue = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await graphqlRequest<{ kvGet: KVEntry }>(KV_GET_QUERY, {
        bucket,
        key: keyName,
      });
      setEntry(data.kvGet);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load value");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    if (expanded) {
      setExpanded(false);
      setEditing(false);
      return;
    }
    setExpanded(true);
    if (!entry) await loadValue();
  };

  const handleEdit = () => {
    if (!entry) return;
    setEditValue(entry.value);
    setEditing(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const data = await graphqlRequest<{ kvPut: KVEntry }>(KV_PUT_MUTATION, {
        bucket,
        key: keyName,
        value: editValue,
      });
      setEntry(data.kvPut);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      setError(null);
      await graphqlRequest(KV_PURGE_MUTATION, { bucket, key: keyName });
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  };

  const valueDisplay = entry && !editing ? tryFormatJSON(entry.value) : null;

  return (
    <div className="py-1.5 first:pt-0">
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 w-full text-left group py-1 rounded hover:bg-muted/30 px-1 -mx-1 transition-colors"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 text-muted-foreground/50 shrink-0 transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        />
        <code className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-mono font-medium text-primary">
          {keyName}
        </code>
        {entry && (
          <span className="text-[11px] text-muted-foreground/40 ml-auto">
            rev {entry.revision}
          </span>
        )}
      </button>

      {expanded && (
        <div className="ml-5 mt-1.5">
          {loading && (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Loading...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 py-1">
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
              <span className="text-xs text-destructive">{error}</span>
            </div>
          )}

          {entry && !editing && valueDisplay && (
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-[11px] text-muted-foreground/50">
                  rev {entry.revision}
                </span>
                <span className="text-[11px] text-muted-foreground/50">
                  {formatEntryTime(entry.created)}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    onClick={handleEdit}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
              <pre
                className={`text-xs rounded-md bg-muted/30 p-2.5 overflow-x-auto font-mono ${
                  valueDisplay.isJSON ? "text-emerald-400/80" : "text-foreground/70"
                }`}
              >
                {valueDisplay.formatted}
              </pre>
            </div>
          )}

          {editing && (
            <div className="space-y-2">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full rounded-md border border-border bg-background p-2.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary min-h-[80px] resize-y"
                disabled={saving}
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  <X className="h-3 w-3" />
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KVKeysDialog({
  bucket,
  open,
  onOpenChange,
  onKeysChanged,
}: {
  bucket: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onKeysChanged?: () => void;
}) {
  const [keys, setKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPut, setShowPut] = useState(false);
  const [putKey, setPutKey] = useState("");
  const [putValue, setPutValue] = useState("");
  const [putting, setPutting] = useState(false);
  const [putError, setPutError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    if (!bucket) return;
    try {
      setLoading(true);
      setError(null);
      const data = await graphqlRequest<{ kvKeys: string[] }>(KV_KEYS_QUERY, {
        bucket,
      });
      setKeys(data.kvKeys);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load keys");
    } finally {
      setLoading(false);
    }
  }, [bucket]);

  useEffect(() => {
    if (!bucket || !open) return;
    fetchKeys();
  }, [bucket, open, fetchKeys]);

  const handlePut = async () => {
    if (!bucket || !putKey.trim()) {
      setPutError("Key is required");
      return;
    }
    try {
      setPutting(true);
      setPutError(null);
      await graphqlRequest(KV_PUT_MUTATION, {
        bucket,
        key: putKey.trim(),
        value: putValue,
      });
      setPutKey("");
      setPutValue("");
      setShowPut(false);
      fetchKeys();
      onKeysChanged?.();
    } catch (err) {
      setPutError(err instanceof Error ? err.message : "Failed to put key");
    } finally {
      setPutting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      onOpenChange(v);
      if (!v) { setShowPut(false); setPutKey(""); setPutValue(""); setPutError(null); }
    }}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              {bucket}
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setShowPut(!showPut)}
            >
              <Plus className="h-3 w-3" />
              Put Key
            </Button>
          </div>
          <DialogDescription>
            {loading ? "Loading keys..." : `${keys.length} key${keys.length !== 1 ? "s" : ""}`}
          </DialogDescription>
        </DialogHeader>

        {/* Put Key form */}
        {showPut && (
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                placeholder="Key name"
                value={putKey}
                onChange={(e) => setPutKey(e.target.value)}
                disabled={putting}
                className="h-8 text-xs font-mono"
              />
            </div>
            <textarea
              placeholder="Value"
              value={putValue}
              onChange={(e) => setPutValue(e.target.value)}
              className="w-full rounded-md border border-border bg-background p-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary min-h-[60px] resize-y"
              disabled={putting}
            />
            {putError && (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs text-destructive">{putError}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={handlePut}
                disabled={putting}
              >
                {putting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                {putting ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setShowPut(false); setPutError(null); }}
                disabled={putting}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

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

          {!loading && !error && keys.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground/60">
              No keys in this bucket
            </p>
          )}

          {!loading && !error && keys.length > 0 && bucket && (
            <div className="divide-y divide-border/20">
              {keys.map((keyName) => (
                <KVKeyRow
                  key={keyName}
                  bucket={bucket}
                  keyName={keyName}
                  onDeleted={() => { fetchKeys(); onKeysChanged?.(); }}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Mobile Card ─── */
function KVCard({
  kv,
  onViewKeys,
  onDelete,
}: {
  kv: KeyValue;
  onViewKeys: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold">{kv.bucket}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={onViewKeys}
            >
              Keys
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
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
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

  const handleDeleteBucket = async (bucket: string) => {
    if (!window.confirm(`Delete KV bucket "${bucket}"? This action cannot be undone.`)) return;
    try {
      await graphqlRequest(KV_DELETE_BUCKET_MUTATION, { bucket });
      fetchKV(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete bucket");
    }
  };

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
        <div className="flex items-center gap-2">
          <CreateKVDialog onCreated={() => fetchKV(true)} />
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
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 sm:p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* KV Keys Dialog */}
      <KVKeysDialog
        bucket={selectedBucket}
        open={selectedBucket !== null}
        onOpenChange={(open) => { if (!open) setSelectedBucket(null); }}
        onKeysChanged={() => fetchKV(true)}
      />

      {/* Mobile: Cards / Desktop: Table */}
      {isMobile ? (
        <div className="space-y-3">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <KVCardSkeleton key={i} />)
            : kvStores.map((kv) => (
                <KVCard
                  key={kv.bucket}
                  kv={kv}
                  onViewKeys={() => setSelectedBucket(kv.bucket)}
                  onDelete={() => handleDeleteBucket(kv.bucket)}
                />
              ))}
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
                <TableHead className="w-10" />
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
                : kvStores.map((kv) => (
                    <TableRow key={kv.bucket} className="group transition-colors cursor-pointer" onClick={() => setSelectedBucket(kv.bucket)}>
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
                      <TableCell className="w-10 px-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBucket(kv.bucket);
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
