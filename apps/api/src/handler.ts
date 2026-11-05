import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";

export type Request = APIGatewayProxyEventV2 & {
  requestContext: {
    authorizer?: { jwt?: { claims?: Record<string, unknown> } };
  };
};

function response(statusCode: number, body: object): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify(body),
  };
}

export async function handler(event: Request): Promise<APIGatewayProxyStructuredResultV2> {
  if (event.requestContext.http.method !== "GET") return response(404, { error: "Not found" });
  if (event.rawPath === "/health") {
    return response(200, { status: "ok", application: "community" });
  }
  if (event.rawPath === "/me") {
    const subject = event.requestContext.authorizer?.jwt?.claims?.sub;
    if (typeof subject !== "string" || subject.length === 0) {
      return response(401, { error: "Authentication required" });
    }
    return response(200, { userId: subject });
  }
  return response(404, { error: "Not found" });
}
