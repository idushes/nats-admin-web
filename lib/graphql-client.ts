const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://graphql.nats.lisacorp.com/query";

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export async function graphqlRequest<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("nats_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const json: GraphQLResponse<T> = await res.json();

  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0].message);
  }

  if (!json.data) {
    throw new Error("No data returned from API");
  }

  return json.data;
}
