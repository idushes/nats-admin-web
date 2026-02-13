"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KeyRound, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { setToken } = useAuth();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();

    if (!trimmed) {
      setError("Token is required");
      return;
    }

    setLoading(true);
    setError("");

    // Verify token by making a test query
    try {
      const res = await fetch(
        process.env.NEXT_PUBLIC_API_URL ||
          "https://graphql.nats.lisacorp.com/query",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${trimmed}`,
          },
          body: JSON.stringify({ query: "{ streams { name } }" }),
        }
      );

      const json = await res.json();

      if (
        res.status === 401 ||
        json.errors?.some((e: { message: string }) =>
          e.message.toLowerCase().includes("unauthorized")
        )
      ) {
        setError("Invalid token");
        setLoading(false);
        return;
      }

      setToken(trimmed);
    } catch {
      setError("Failed to connect to API");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {/* Subtle background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/5 blur-[120px]" />
        <div className="absolute right-1/4 bottom-1/4 h-[300px] w-[300px] rounded-full bg-purple-500/5 blur-[100px]" />
      </div>

      <Card className="relative w-full max-w-md border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <KeyRound className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            NATS Admin
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter your Bearer token to access the admin panel
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token" className="text-sm font-medium">
                API Token
              </Label>
              <Input
                id="token"
                type="password"
                placeholder="your-bearer-token"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError("");
                }}
                className="h-11 bg-background/50"
                autoFocus
              />
              {error && (
                <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1">
                  {error}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="h-11 w-full font-medium"
              disabled={loading || !value.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
