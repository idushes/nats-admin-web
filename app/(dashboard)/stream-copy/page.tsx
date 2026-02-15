"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { graphqlRequest } from "@/lib/graphql-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  AlertCircle,
  Loader2,
  Play,
  CheckCircle2,
  ArrowRight,
  Copy,
  Radio,
} from "lucide-react";

/* ─── Types ─── */
interface StreamInfo {
  name: string;
  subjects: string[];
  messages: number;
}

interface StreamMessage {
  sequence: number;
  subject: string;
  data: string;
  published: string;
}

interface LogEntry {
  id: number;
  type: "info" | "success" | "error";
  message: string;
  timestamp: Date;
}

/* ─── GraphQL ─── */
const STREAMS_QUERY = `
  query {
    streams {
      name
      subjects
      messages
    }
  }
`;

const MESSAGES_QUERY = `
  query($stream: String!, $last: Int!, $subject: String, $startSeq: Int) {
    streamMessages(stream: $stream, last: $last, subject: $subject, startSeq: $startSeq) {
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

/* ─── Component ─── */
export default function StreamCopyPage() {
  /* Streams list */
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [loadingStreams, setLoadingStreams] = useState(true);

  /* Form state */
  const [sourceStream, setSourceStream] = useState("");
  const [targetStream, setTargetStream] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [maxMessages, setMaxMessages] = useState("100");

  /* Copy state */
  const [copying, setCopying] = useState(false);
  const [progress, setProgress] = useState({ total: 0, copied: 0, errors: 0 });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef(false);
  const logIdRef = useRef(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    const entry: LogEntry = {
      id: logIdRef.current++,
      type,
      message,
      timestamp: new Date(),
    };
    setLogs((prev) => [...prev, entry]);
  }, []);

  /* Auto-scroll logs */
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  /* Fetch streams */
  const fetchStreams = useCallback(async () => {
    try {
      setLoadingStreams(true);
      const data = await graphqlRequest<{ streams: StreamInfo[] }>(
        STREAMS_QUERY,
      );
      setStreams(data.streams.filter((s) => !s.name.startsWith("KV_")));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load streams");
    } finally {
      setLoadingStreams(false);
    }
  }, []);

  useEffect(() => {
    fetchStreams();
  }, [fetchStreams]);

  /* Available target streams (exclude source) */
  const targetStreams = streams.filter((s) => s.name !== sourceStream);

  /* Source stream info */
  const sourceInfo = streams.find((s) => s.name === sourceStream);

  /* Reset state on stream change */
  useEffect(() => {
    if (targetStream === sourceStream) {
      setTargetStream("");
    }
  }, [sourceStream, targetStream]);

  /* Copy handler */
  const handleCopy = async () => {
    if (!sourceStream || !targetStream) {
      setError("Select both source and target streams");
      return;
    }

    if (sourceStream === targetStream) {
      setError("Source and target streams must be different");
      return;
    }

    const limit = parseInt(maxMessages) || 100;

    setCopying(true);
    setDone(false);
    setError(null);
    setLogs([]);
    setProgress({ total: 0, copied: 0, errors: 0 });
    abortRef.current = false;

    try {
      /* Step 1: Fetch messages */
      addLog(
        "info",
        `Fetching up to ${limit} messages from "${sourceStream}"${subjectFilter ? ` with filter "${subjectFilter}"` : ""}...`,
      );

      const variables: Record<string, unknown> = {
        stream: sourceStream,
        last: limit,
      };
      if (subjectFilter.trim()) {
        variables.subject = subjectFilter.trim();
      }

      const data = await graphqlRequest<{
        streamMessages: StreamMessage[];
      }>(MESSAGES_QUERY, variables);

      const messages = data.streamMessages;

      if (messages.length === 0) {
        addLog("info", "No messages found matching the filter.");
        setDone(true);
        setCopying(false);
        return;
      }

      addLog(
        "success",
        `Found ${messages.length} message${messages.length !== 1 ? "s" : ""}`,
      );
      setProgress({ total: messages.length, copied: 0, errors: 0 });

      /* Step 2: Publish messages to target */
      let copied = 0;
      let errors = 0;

      for (const msg of messages) {
        if (abortRef.current) {
          addLog("info", "Copy aborted by user.");
          break;
        }

        try {
          await graphqlRequest(PUBLISH_MUTATION, {
            subject: msg.subject,
            data: msg.data,
          });
          copied++;
          setProgress((prev) => ({ ...prev, copied: copied }));

          if (copied % 10 === 0 || copied === messages.length) {
            addLog("info", `Copied ${copied}/${messages.length} messages...`);
          }
        } catch (err) {
          errors++;
          setProgress((prev) => ({ ...prev, errors }));
          addLog(
            "error",
            `Failed to copy seq #${msg.sequence} (${msg.subject}): ${err instanceof Error ? err.message : "Unknown error"}`,
          );
        }
      }

      addLog(
        "success",
        `Done! Copied ${copied} message${copied !== 1 ? "s" : ""}${errors > 0 ? `, ${errors} error${errors !== 1 ? "s" : ""}` : ""}.`,
      );
      setDone(true);
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "Failed to fetch messages";
      setError(errMsg);
      addLog("error", errMsg);
    } finally {
      setCopying(false);
    }
  };

  const handleAbort = () => {
    abortRef.current = true;
  };

  const progressPercent =
    progress.total > 0
      ? Math.round((progress.copied / progress.total) * 100)
      : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Stream Copy
          </h2>
          <p className="text-sm text-muted-foreground">
            Copy messages from one stream to another by subject filter
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchStreams()}
          disabled={loadingStreams}
          className="gap-2"
        >
          <RefreshCw
            className={`h-4 w-4 ${loadingStreams ? "animate-spin" : ""}`}
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

      {/* Configuration Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-4 sm:p-6 space-y-5">
          {/* Source & Target */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 items-end">
            {/* Source */}
            <div className="grid gap-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground/70">
                Source Stream
              </Label>
              <Select
                value={sourceStream}
                onValueChange={setSourceStream}
                disabled={copying || loadingStreams}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source stream..." />
                </SelectTrigger>
                <SelectContent>
                  {streams.map((s) => (
                    <SelectItem key={s.name} value={s.name}>
                      <div className="flex items-center gap-2">
                        <Radio className="h-3 w-3 text-muted-foreground" />
                        <span>{s.name}</span>
                        <span className="text-xs text-muted-foreground/60 ml-auto">
                          {s.messages.toLocaleString()} msgs
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sourceInfo && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {sourceInfo.subjects.map((subj) => (
                    <code
                      key={subj}
                      className="rounded bg-muted/50 px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground"
                    >
                      {subj}
                    </code>
                  ))}
                </div>
              )}
            </div>

            {/* Arrow */}
            <div className="hidden sm:flex items-center justify-center pb-1">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 border border-primary/20">
                <ArrowRight className="h-4 w-4 text-primary" />
              </div>
            </div>

            {/* Target */}
            <div className="grid gap-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground/70">
                Target Stream
              </Label>
              <Select
                value={targetStream}
                onValueChange={setTargetStream}
                disabled={copying || loadingStreams || !sourceStream}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select target stream..." />
                </SelectTrigger>
                <SelectContent>
                  {targetStreams.map((s) => (
                    <SelectItem key={s.name} value={s.name}>
                      <div className="flex items-center gap-2">
                        <Radio className="h-3 w-3 text-muted-foreground" />
                        <span>{s.name}</span>
                        <span className="text-xs text-muted-foreground/60 ml-auto">
                          {s.messages.toLocaleString()} msgs
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filter & Limit */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-4">
            <div className="grid gap-2">
              <Label
                htmlFor="subject-filter"
                className="text-xs uppercase tracking-wider text-muted-foreground/70"
              >
                Subject Filter
              </Label>
              <Input
                id="subject-filter"
                placeholder="e.g. orders.> or payments.*"
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                disabled={copying}
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground/60">
                NATS subject pattern. Leave empty to copy all messages.
              </p>
            </div>
            <div className="grid gap-2">
              <Label
                htmlFor="max-messages"
                className="text-xs uppercase tracking-wider text-muted-foreground/70"
              >
                Max Messages
              </Label>
              <Input
                id="max-messages"
                type="number"
                min="1"
                max="10000"
                value={maxMessages}
                onChange={(e) => setMaxMessages(e.target.value)}
                disabled={copying}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            {!copying ? (
              <Button
                onClick={handleCopy}
                disabled={!sourceStream || !targetStream || loadingStreams}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                Start Copy
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={handleAbort}
                className="gap-2"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Abort
              </Button>
            )}

            {done && !copying && (
              <Badge
                variant="outline"
                className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 gap-1.5"
              >
                <CheckCircle2 className="h-3 w-3" />
                Complete
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      {(copying || done) && progress.total > 0 && (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-4 sm:p-6 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-mono font-medium">
                {progress.copied}/{progress.total}
                {progress.errors > 0 && (
                  <span className="text-destructive ml-2">
                    ({progress.errors} errors)
                  </span>
                )}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <p className="text-xs text-muted-foreground/60 text-right">
              {progressPercent}%
            </p>
          </CardContent>
        </Card>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border/30">
              <span className="text-xs uppercase tracking-wider text-muted-foreground/70 font-medium">
                Log
              </span>
              <span className="text-[11px] text-muted-foreground/50">
                {logs.length} entries
              </span>
            </div>
            <div
              ref={logContainerRef}
              className="max-h-[280px] overflow-y-auto p-3 sm:p-4 space-y-1"
            >
              {logs.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-2 text-xs font-mono"
                >
                  <span className="text-[10px] text-muted-foreground/40 shrink-0 pt-0.5 tabular-nums">
                    {entry.timestamp.toLocaleTimeString("en-US", {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  {entry.type === "success" && (
                    <Play className="h-3 w-3 shrink-0 mt-0.5 text-emerald-400" />
                  )}
                  {entry.type === "error" && (
                    <AlertCircle className="h-3 w-3 shrink-0 mt-0.5 text-destructive" />
                  )}
                  {entry.type === "info" && (
                    <span className="w-3 shrink-0 text-center text-muted-foreground/40 mt-px">
                      ›
                    </span>
                  )}
                  <span
                    className={
                      entry.type === "error"
                        ? "text-destructive/80"
                        : entry.type === "success"
                          ? "text-emerald-400/80"
                          : "text-muted-foreground/70"
                    }
                  >
                    {entry.message}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
