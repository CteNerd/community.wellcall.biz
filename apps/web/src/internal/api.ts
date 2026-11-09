import type { AdultApplication, ApplicationReviewAction } from "../../../../packages/domain/src/adult-application.ts";

export type ApplicantReceipt = Pick<AdultApplication, "applicationId" | "kind" | "status" | "withdrawnAt"> & {
  version: number; createdAt: string;
};
export type ReviewApplication = AdultApplication & {
  version: number; createdAt: string; contactName: string; contactEmail: string;
};
export type Submission = {
  kind: "participant" | "mentor"; contactName: string; contactEmail: string; consentAccepted: true;
};
export type ReviewPage = { applications: ReviewApplication[]; nextToken: string | null };
export interface ApplicationApi {
  submit(input: Submission, idempotencyKey: string): Promise<{ applicationId: string; status: "under_review" }>;
  owned(id: string): Promise<ApplicantReceipt>;
  withdraw(id: string, expectedVersion: number): Promise<ApplicantReceipt>;
  list(nextToken?: string): Promise<ReviewPage>;
  review(id: string, expectedVersion: number, action: ApplicationReviewAction): Promise<ReviewApplication>;
}

export class ApiError extends Error {
  constructor(public readonly status: number) {
    super(status === 401 ? "Session expired. Sign in again."
      : status === 403 ? "Access denied. Reviewer access has been cleared."
      : status === 404 ? "Application not found or not available to this account."
      : status === 409 ? "Application changed or action is not allowed. Refresh before trying again."
      : status === 503 ? "Submission remains closed on the server."
      : status === 400 ? "Request was not accepted. Check the fields and refresh."
      : "Request failed. No successful change is confirmed; try again or refresh.");
    this.name = "ApiError";
  }
}

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const validApplicationId = (id: string) => idPattern.test(id);
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function applicantReceipt(value: unknown): ApplicantReceipt {
  if (!record(value) || typeof value.applicationId !== "string" || !validApplicationId(value.applicationId)
    || (value.kind !== "mentor" && value.kind !== "participant")
    || !["under_review", "approved", "rejected", "withdrawn"].includes(String(value.status))
    || !Number.isSafeInteger(value.version) || Number(value.version) < 0 || typeof value.createdAt !== "string") {
    throw new ApiError(502);
  }
  // Allowlist owner-facing fields even if a misconfigured server returns reviewer data.
  return {
    applicationId: value.applicationId, kind: value.kind, status: value.status as ApplicantReceipt["status"],
    version: Number(value.version), createdAt: value.createdAt,
    ...(typeof value.withdrawnAt === "string" ? { withdrawnAt: value.withdrawnAt } : {}),
  };
}

function reviewRecord(value: unknown): ReviewApplication {
  const receipt = applicantReceipt(value);
  if (!record(value) || !record(value.adultEligibility)
    || !["unverified", "verified"].includes(String(value.adultEligibility.status))
    || !["not_required", "pending", "passed", "failed"].includes(String(value.mentorScreening))
    || typeof value.contactName !== "string" || typeof value.contactEmail !== "string") throw new ApiError(502);
  return { ...value, ...receipt } as ReviewApplication;
}

export function createApplicationApi(
  base: string, accessToken: () => string | null, onDenied: (status: number) => void,
  fetcher: typeof fetch = fetch,
): ApplicationApi {
  async function request(path: string, method = "GET", body?: object, key?: string): Promise<unknown> {
    const token = accessToken();
    if (!token) { onDenied(401); throw new ApiError(401); }
    let response: Response;
    try {
      response = await fetcher(`${base}${path}`, {
        method, cache: "no-store", credentials: "omit", redirect: "error",
        headers: {
          Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}),
          ...(key ? { "Idempotency-Key": key } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch { throw new ApiError(0); }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) onDenied(response.status);
      throw new ApiError(response.status);
    }
    try { return await response.json(); } catch { throw new ApiError(502); }
  }
  const id = (value: string) => {
    if (!validApplicationId(value)) throw new ApiError(400);
    return encodeURIComponent(value);
  };
  return {
    async submit(input, key) {
      const value = await request("/applications", "POST", input, key);
      if (!record(value) || typeof value.applicationId !== "string"
        || !validApplicationId(value.applicationId) || value.status !== "under_review") throw new ApiError(502);
      return { applicationId: value.applicationId, status: "under_review" };
    },
    async owned(value) { return applicantReceipt(await request(`/applications/${id(value)}`)); },
    async withdraw(value, version) {
      return applicantReceipt(await request(`/applications/${id(value)}/withdraw`, "POST", { expectedVersion: version }));
    },
    async list(nextToken) {
      if (nextToken && nextToken.length > 2048) throw new ApiError(400);
      const value = await request(`/admin/applications${nextToken ? `?nextToken=${encodeURIComponent(nextToken)}` : ""}`);
      if (!record(value) || !Array.isArray(value.applications) || value.applications.length > 25
        || (value.nextToken !== null && (typeof value.nextToken !== "string" || value.nextToken.length > 2048))) {
        throw new ApiError(502);
      }
      return { applications: value.applications.map(reviewRecord), nextToken: value.nextToken };
    },
    async review(value, version, action) {
      const { type, ...rest } = action;
      return reviewRecord(await request(`/admin/applications/${id(value)}`, "PATCH", {
        action: type, ...rest, expectedVersion: version,
      }));
    },
  };
}
