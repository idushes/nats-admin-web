"use client";

import { useEffect, useState, useCallback } from "react";
import { graphqlRequest } from "@/lib/graphql-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  Plus,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  Globe,
  X,
  CalendarClock,
  ChevronDown,
} from "lucide-react";

/* ─── GraphQL ─── */
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

const SCHEDULER_BUCKET = "scheduler";

/* ─── Types ─── */
interface SchedulerEntry {
  subject: string;
  schedule: string;
  timezone: string;
  url: string;
  url_method: string;
  url_headers: Array<{ key: string; value: string }>;
}

interface KVEntry {
  key: string;
  value: string;
  revision: number;
  created: string;
}

interface SchedulerItem {
  key: string;
  entry: SchedulerEntry;
  revision?: number;
}

const DEFAULT_ENTRY: SchedulerEntry = {
  subject: "",
  schedule: "*/5 * * * *",
  timezone: "UTC",
  url: "",
  url_method: "GET",
  url_headers: [],
};

/* ─── Scheduler Entry Dialog ─── */
function SchedulerEntryDialog({
  open,
  onOpenChange,
  editItem,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem: SchedulerItem | null;
  onSaved: () => void;
}) {
  const [key, setKey] = useState("");
  const [entry, setEntry] = useState<SchedulerEntry>({ ...DEFAULT_ENTRY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrlSection, setShowUrlSection] = useState(false);

  const isEditing = editItem !== null;

  useEffect(() => {
    if (open) {
      if (editItem) {
        setKey(editItem.key);
        setEntry({ ...editItem.entry });
        setShowUrlSection(!!editItem.entry.url);
      } else {
        setKey("");
        setEntry({ ...DEFAULT_ENTRY, url_headers: [] });
        setShowUrlSection(false);
      }
      setError(null);
    }
  }, [open, editItem]);

  const updateEntry = <K extends keyof SchedulerEntry>(
    field: K,
    value: SchedulerEntry[K],
  ) => {
    setEntry((prev) => ({ ...prev, [field]: value }));
  };

  const addHeader = () => {
    setEntry((prev) => ({
      ...prev,
      url_headers: [...prev.url_headers, { key: "", value: "" }],
    }));
  };

  const removeHeader = (index: number) => {
    setEntry((prev) => ({
      ...prev,
      url_headers: prev.url_headers.filter((_, i) => i !== index),
    }));
  };

  const updateHeader = (
    index: number,
    field: "key" | "value",
    value: string,
  ) => {
    setEntry((prev) => ({
      ...prev,
      url_headers: prev.url_headers.map((h, i) =>
        i === index ? { ...h, [field]: value } : h,
      ),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!key.trim()) {
      setError("Entry name (key) is required");
      return;
    }
    if (!entry.subject.trim()) {
      setError("Subject is required");
      return;
    }
    if (!entry.schedule.trim()) {
      setError("Schedule is required");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload: Record<string, unknown> = {
        subject: entry.subject.trim(),
        schedule: entry.schedule.trim(),
        timezone: entry.timezone.trim() || "UTC",
      };

      if (entry.url.trim()) {
        payload.url = entry.url.trim();
        payload.url_method = entry.url_method;
        payload.url_headers = entry.url_headers.filter(
          (h) => h.key.trim() && h.value.trim(),
        );
      }

      const jsonValue = JSON.stringify(payload);

      await graphqlRequest(KV_PUT_MUTATION, {
        bucket: SCHEDULER_BUCKET,
        key: key.trim(),
        value: jsonValue,
      });

      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              {isEditing ? "Edit Scheduler Entry" : "New Scheduler Entry"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? `Editing entry "${editItem.key}" in the scheduler bucket.`
                : "Create a new cron-scheduled entry in the scheduler KV bucket."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Key / Entry name */}
            <div className="space-y-1.5">
              <Label htmlFor="entry-key">Entry Name (KV Key)</Label>
              <Input
                id="entry-key"
                placeholder="e.g. funding.loris.tool.rate"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                disabled={saving || isEditing}
                className="font-mono text-sm"
                autoFocus={!isEditing}
              />
              {isEditing && (
                <p className="text-xs text-muted-foreground">
                  Key cannot be changed when editing.
                </p>
              )}
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <Label htmlFor="subject">NATS Subject</Label>
              <Input
                id="subject"
                placeholder="funding.loris.tool.rate"
                value={entry.subject}
                onChange={(e) => updateEntry("subject", e.target.value)}
                disabled={saving}
                className="font-mono text-sm"
              />
            </div>

            {/* Schedule + Timezone row */}
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="schedule">Cron Schedule</Label>
                <Input
                  id="schedule"
                  placeholder="*/5 * * * *"
                  value={entry.schedule}
                  onChange={(e) => updateEntry("schedule", e.target.value)}
                  disabled={saving}
                  className="font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground/60">
                  Standard 5-field cron expression
                </p>
              </div>
              <div className="w-28 space-y-1.5">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  placeholder="UTC"
                  value={entry.timezone}
                  onChange={(e) => updateEntry("timezone", e.target.value)}
                  disabled={saving}
                  className="text-sm"
                />
              </div>
            </div>

            {/* URL Settings — optional collapsible */}
            <div className="rounded-md border border-border/40">
              <button
                type="button"
                className="flex items-center justify-between w-full px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md"
                onClick={() => setShowUrlSection(!showUrlSection)}
              >
                <span className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5" />
                  URL Settings
                  <span className="text-[11px] text-muted-foreground/40 font-normal">
                    (optional)
                  </span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${
                    showUrlSection ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showUrlSection && (
                <div className="border-t border-border/30 px-3 pb-3 pt-3 space-y-3">
                  {/* URL */}
                  <div className="space-y-1.5">
                    <Label htmlFor="url">URL</Label>
                    <Input
                      id="url"
                      placeholder="https://api.example.com/data"
                      value={entry.url}
                      onChange={(e) => updateEntry("url", e.target.value)}
                      disabled={saving}
                      className="font-mono text-sm"
                    />
                  </div>

                  {/* Method */}
                  <div className="space-y-1.5">
                    <Label>Method</Label>
                    <Select
                      value={entry.url_method}
                      onValueChange={(v) => updateEntry("url_method", v)}
                      disabled={saving}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Headers */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Headers</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                        onClick={addHeader}
                        disabled={saving}
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </Button>
                    </div>

                    {entry.url_headers.length === 0 && (
                      <p className="text-xs text-muted-foreground/40 italic">
                        No headers
                      </p>
                    )}

                    <div className="space-y-1.5">
                      {entry.url_headers.map((header, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            placeholder="Name"
                            value={header.key}
                            onChange={(e) =>
                              updateHeader(i, "key", e.target.value)
                            }
                            disabled={saving}
                            className="h-8 text-xs font-mono flex-1"
                          />
                          <Input
                            placeholder="Value"
                            value={header.value}
                            onChange={(e) =>
                              updateHeader(i, "value", e.target.value)
                            }
                            disabled={saving}
                            className="h-8 text-xs font-mono flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeHeader(i)}
                            disabled={saving}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>

          <DialogFooter className="mt-5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving..." : isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Scheduler Entry Row ─── */
function SchedulerEntryRow({
  item,
  onEdit,
  onDelete,
  deleting,
}: {
  item: SchedulerItem;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40 group">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-mono font-medium text-primary">
            {item.key}
          </code>
          {item.entry.url && (
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]"
            >
              {item.entry.url_method}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3 shrink-0" />
            <span className="font-mono">{item.entry.schedule}</span>
          </span>
          {item.entry.url && (
            <span className="inline-flex items-center gap-1 min-w-0">
              <Globe className="h-3 w-3 shrink-0" />
              <span className="font-mono truncate max-w-[200px]">
                {item.entry.url}
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          disabled={deleting}
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function UtilitiesPage() {
  const [items, setItems] = useState<SchedulerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<SchedulerItem | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let keys: string[] = [];
      try {
        const keysData = await graphqlRequest<{ kvKeys: string[] }>(
          KV_KEYS_QUERY,
          { bucket: SCHEDULER_BUCKET },
        );
        keys = keysData.kvKeys;
      } catch {
        // bucket may not exist yet
        setItems([]);
        setLoading(false);
        return;
      }

      const entries: SchedulerItem[] = [];
      for (const keyName of keys) {
        try {
          const data = await graphqlRequest<{ kvGet: KVEntry }>(KV_GET_QUERY, {
            bucket: SCHEDULER_BUCKET,
            key: keyName,
          });
          const parsed = JSON.parse(data.kvGet.value) as SchedulerEntry;
          entries.push({
            key: keyName,
            entry: {
              subject: parsed.subject || "",
              schedule: parsed.schedule || "",
              timezone: parsed.timezone || "UTC",
              url: parsed.url || "",
              url_method: parsed.url_method || "GET",
              url_headers: Array.isArray(parsed.url_headers)
                ? parsed.url_headers
                : [],
            },
            revision: data.kvGet.revision,
          });
        } catch {
          // skip unparseable entries
        }
      }

      setItems(entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load entries");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleAdd = () => {
    setEditItem(null);
    setDialogOpen(true);
  };

  const handleEdit = (item: SchedulerItem) => {
    setEditItem(item);
    setDialogOpen(true);
  };

  const handleDelete = async (key: string) => {
    try {
      setDeletingKey(key);
      await graphqlRequest(KV_PURGE_MUTATION, {
        bucket: SCHEDULER_BUCKET,
        key,
      });
      fetchEntries();
    } catch {
      // silently fail
    } finally {
      setDeletingKey(null);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Scheduler Card */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-5">
          {/* Card Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10">
                <CalendarClock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Scheduler</h2>
                <p className="text-xs text-muted-foreground/60">
                  Manage cron-scheduled KV entries
                </p>
              </div>
            </div>
            <Button size="sm" className="gap-2" onClick={handleAdd}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Entry</span>
            </Button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 mb-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && items.length === 0 && (
            <div className="py-10 text-center">
              <CalendarClock className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground/60">
                No scheduler entries yet
              </p>
              <p className="text-xs text-muted-foreground/40 mt-1">
                Click &quot;Add Entry&quot; to create your first scheduled task
              </p>
            </div>
          )}

          {/* Entries list */}
          {!loading && !error && items.length > 0 && (
            <div className="space-y-2">
              {items.map((item) => (
                <SchedulerEntryRow
                  key={item.key}
                  item={item}
                  onEdit={() => handleEdit(item)}
                  onDelete={() => handleDelete(item.key)}
                  deleting={deletingKey === item.key}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <SchedulerEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editItem={editItem}
        onSaved={fetchEntries}
      />
    </div>
  );
}
