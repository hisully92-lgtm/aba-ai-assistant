type ClaimPayload = {
  clientId: string;
  providerNpi: string;
  insuranceProvider: string;
  memberId: string;
  authorizationNumber?: string;
  diagnosisCode: string;
  cptCodes: { code: string; units: number; rate: number }[];
  serviceDate: string;
  totalAmount: number;
  clearinghouse?: "availity" | "change_healthcare" | "office_ally";
};

export async function submitEDIClaim(payload: ClaimPayload): Promise<{
  success: boolean;
  claimId?: string;
  scaffold?: boolean;
  message?: string;
}> {
  try {
    const res = await fetch("/api/edi/submit-claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (data.scaffold) {
      console.log("[EDI] Scaffold mode:", data.message);
      return { success: false, scaffold: true, message: data.message, claimId: data.claim_id };
    }

    return { success: data.success, claimId: data.claim_id };
  } catch (err) {
    console.error("[EDI] Error:", err);
    return { success: false, message: "EDI submission failed" };
  }
}

export async function verifyNPI(npi: string): Promise<{
  valid: boolean;
  name?: string;
  credential?: string;
  taxonomy?: string;
}> {
  try {
    const res = await fetch(`/api/npi/verify?npi=${npi}`);
    const data = await res.json();

    if (!data.success || !data.results?.length) {
      return { valid: false };
    }

    const result = data.results[0];
    return {
      valid: result.status === "A",
      name: result.name,
      credential: result.credential,
      taxonomy: result.taxonomy,
    };
  } catch {
    return { valid: false };
  }
}