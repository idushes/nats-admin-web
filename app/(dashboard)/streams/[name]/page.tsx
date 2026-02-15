"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { graphqlRequest } from "@/lib/graphql-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Send,
  Copy,
  Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ─── Types ─── */
interface StreamMessage {
  sequence: number;
  subject: string;
  data: string;
  published: string;
}

/* ─── GraphQL ─── */
const MESSAGES_QUERY = `
  query($stream: String!, $last: Int!, $subject: String) {
    streamMessages(stream: $stream, last: $last, subject: $subject) {
      sequence
      subject
      data
      published
    }
  }
`;

const PUBLISH_MUTATION = `
  mutation($subject: String!, $data: String!) {
    publish(subject: $subject, data: $data) {
      stream
      sequence
    }
  }
`;

/* ─── Helpers ─── */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function tryFormatJSON(data: string): { formatted: string; isJSON: boolean } {
  try {
    const parsed = JSON.parse(data);
    return { formatted: JSON.stringify(parsed, null, 2), isJSON: true };
  } catch {
    return { formatted: data, isJSON: false };
  }
}

function truncateData(data: string, max = 120): string {
  if (data.length <= max) return data;
  return data.slice(0, max) + "…";
}

/* ─── JSON Syntax Highlighting ─── */
function JsonHighlight({ json }: { json: string }) {
  const tokens = json.split(
    /("(?:\\.|[^"\\])*"\s*:\s*|"(?:\\.|[^"\\])*"|(?:\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?))/g
  );

  return (
    <>
      {tokens.map((token, i) => {
        if (/".*":\s*$/.test(token)) {
          const colonIdx = token.lastIndexOf(":");
          return (
            <span key={i}>
              <span className="text-sky-300/70">{token.slice(0, colonIdx)}</span>
              <span className="text-muted-foreground/40">{token.slice(colonIdx)}</span>
            </span>
          );
        }
        if (/^"/.test(token)) {
          return <span key={i} className="text-emerald-300/60">{token}</span>;
        }
        if (/^(true|false)$/.test(token)) {
          return <span key={i} className="text-amber-300/60">{token}</span>;
        }
        if (/^null$/.test(token)) {
          return <span key={i} className="text-rose-300/50">{token}</span>;
        }
        if (/^-?\d/.test(token)) {
          return <span key={i} className="text-purple-300/60">{token}</span>;
        }
        return <span key={i} className="text-muted-foreground/40">{token}</span>;
      })}
    </>
  );
}

/* ─── Compact Message Row ─── */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-primary transition-colors"
      title={`Copy ${label}`}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

const MAX_RENDER_SIZE = 5000; // 5 KB — don't render messages larger than this

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MessageRow({ msg }: { msg: StreamMessage }) {
  const [expanded, setExpanded] = useState(false);
  const isLarge = msg.data.length > MAX_RENDER_SIZE;

  // Only parse/format if not too large
  const { formatted, isJSON } = isLarge
    ? { formatted: "", isJSON: false }
    : tryFormatJSON(msg.data);

  // Preview in the collapsed row — always safe (max 120 chars)
  const preview = (() => {
    if (isLarge) {
      try {
        return truncateData(JSON.stringify(JSON.parse(msg.data)), 120);
      } catch {
        return truncateData(msg.data, 120);
      }
    }
    return isJSON
      ? truncateData(JSON.stringify(JSON.parse(msg.data)), 120)
      : truncateData(msg.data, 120);
  })();

  const previewIsJSON = (() => {
    if (isLarge) {
      try { JSON.parse(msg.data); return true; } catch { return false; }
    }
    return isJSON;
  })();

  // For large messages, show a truncated preview in the expanded view
  const truncatedPreview = isLarge
    ? msg.data.slice(0, 2000) + "\n\n… (truncated)"
    : "";

  return (
    <div className="border-b border-border/20 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-muted/20 transition-colors"
      >
        <span className="font-mono text-[11px] text-muted-foreground/50 shrink-0 w-12 tabular-nums text-right">
          #{msg.sequence}
        </span>
        <code className="text-[11px] font-mono text-primary/70 shrink-0 bg-primary/5 rounded px-1.5 py-0.5">
          {msg.subject}
        </code>
        <span className="text-[11px] font-mono truncate flex-1">
          {previewIsJSON ? <JsonHighlight json={preview} /> : <span className="text-muted-foreground/50">{preview}</span>}
        </span>
        {isLarge && (
          <span className="text-[10px] text-amber-400/60 shrink-0 font-mono">
            {formatSize(msg.data.length)}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground/40 shrink-0 tabular-nums">
          {formatTime(msg.published)}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-1 ml-[60px] space-y-1.5">
          <div className="flex items-center gap-2">
            <CopyButton text={msg.subject} label="subject" />
            <span className="text-[10px] text-muted-foreground/40">subject</span>
            <CopyButton text={msg.data} label="data" />
            <span className="text-[10px] text-muted-foreground/40">data</span>
          </div>

          {isLarge ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 text-amber-400/70 shrink-0" />
                <span className="text-xs text-amber-300/70">
                  Large message ({formatSize(msg.data.length)}) — showing preview, use copy button for full content
                </span>
              </div>
              <pre className="text-xs rounded-md bg-muted/30 p-2.5 overflow-x-auto font-mono text-foreground/50 max-h-[300px] overflow-y-auto">
                {truncatedPreview}
              </pre>
            </div>
          ) : isJSON ? (
            <pre className="text-xs rounded-md bg-muted/30 p-2.5 overflow-x-auto font-mono">
              <JsonHighlight json={formatted} />
            </pre>
          ) : (
            <pre className="text-xs rounded-md bg-muted/30 p-2.5 overflow-x-auto font-mono text-foreground/70">
              {formatted}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Quick Publish ─── */
function QuickPublish({ streamName }: { streamName: string }) {
  const [subject, setSubject] = useState("");
  const [data, setData] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setError("Subject is required");
      return;
    }
    try {
      setPublishing(true);
      setError(null);
      setSuccess(null);

      const result = await graphqlRequest<{
        publish: { stream: string; sequence: number };
      }>(PUBLISH_MUTATION, { subject: subject.trim(), data });

      setSuccess(`seq #${result.publish.sequence}`);
      setData("");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <form
      onSubmit={handlePublish}
      className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm p-3 space-y-2"
    >
      <div className="flex items-center gap-2">
        <Send className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
        <span className="text-xs font-medium text-muted-foreground/70">
          Publish to {streamName}
        </span>
        {success && (
          <span className="text-[11px] text-emerald-400 ml-auto">
            ✓ {success}
          </span>
        )}
        {error && (
          <span className="text-[11px] text-destructive ml-auto">{error}</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={publishing}
          className="h-8 text-xs font-mono flex-[2]"
        />
        <Input
          placeholder='{"data": "value"}'
          value={data}
          onChange={(e) => setData(e.target.value)}
          disabled={publishing}
          className="h-8 text-xs font-mono flex-[3]"
        />
        <Button
          type="submit"
          size="sm"
          disabled={publishing}
          className="h-8 px-3 gap-1.5"
        >
          {publishing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Send className="h-3 w-3" />
          )}
        </Button>
      </div>
    </form>
  );
}

/* ─── Page ─── */
export default function StreamMessagesPage() {
  const params = useParams();
  const router = useRouter();
  const streamName = decodeURIComponent(params.name as string);

  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [limit, setLimit] = useState(30);

  const fetchMessages = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const variables: Record<string, unknown> = {
          stream: streamName,
          last: limit,
        };
        if (subjectFilter.trim()) {
          variables.subject = subjectFilter.trim();
        }

        const data = await graphqlRequest<{
          streamMessages: StreamMessage[];
        }>(MESSAGES_QUERY, variables);
        setMessages(data.streamMessages);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load messages"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [streamName, subjectFilter, limit]
  );

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => router.push("/streams")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight">
              {streamName}
            </h2>
            <p className="text-xs text-muted-foreground">
              {loading
                ? "Loading..."
                : `${messages.length} message${messages.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <Input
              placeholder="filter by subject..."
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="h-8 w-[180px] text-xs font-mono"
            />
          </div>
          <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
            <SelectTrigger className="h-8 w-[72px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchMessages(true)}
            disabled={refreshing}
            className="h-8 gap-1.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline text-xs">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Mobile subject filter */}
      <div className="sm:hidden">
        <Input
          placeholder="filter by subject..."
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="h-8 text-xs font-mono"
        />
      </div>

      {/* Quick Publish */}
      <QuickPublish streamName={streamName} />

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Messages */}
      <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-border/20">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground/60">
            No messages found
          </p>
        ) : (
          <div>
            {[...messages].reverse().map((msg) => (
              <MessageRow key={msg.sequence} msg={msg} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
