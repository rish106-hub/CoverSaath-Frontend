import { describe, expect, it } from "vitest";
import { z } from "zod";
import { adapters } from "@/adapters";
import * as S from "@/adapters/schemas";

describe("mock adapters return schema-valid data", () => {
  it("household and me", async () => {
    S.householdSchema.parse(await adapters.household.household());
    S.meSchema.parse(await adapters.household.me());
  });
  it("access", async () => S.accessResultSchema.parse(await adapters.access.submit({ name: "Meera Rao", email: "meera.rao@company.com" })));
  it("policies and reading", async () => {
    z.array(S.policySchema).parse(await adapters.policy.list());
    z.array(S.findingSchema).parse(await adapters.reading.findings("meridian-senior"));
  });
  it("documents, email, receipts", async () => {
    z.array(S.documentSchema).parse(await adapters.document.list());
    const scan = S.emailScanSchema.parse(await adapters.email.scan());
    S.reconcileResultSchema.parse(await adapters.reconcile.reconcile(scan.items));
  });
  it("reconcile finds the duplicate premium", async () => {
    const scan = await adapters.email.scan();
    const r = await adapters.reconcile.reconcile(scan.items);
    expect(r.duplicates).toBe(1);
    expect(r.refundRs).toBe(8400);
  });
  it("desk, hospitals, blood, learn", async () => {
    z.array(S.deskCaseSchema).parse(await adapters.desk.cases());
    z.array(S.hospitalSchema).parse(await adapters.hospital.nearby());
    z.array(S.bloodSchema).parse(await adapters.blood.stock());
    z.array(S.learnPostSchema).parse(await adapters.learn.posts());
  });
  it("assistant, invite, wallet, notify, auth", async () => {
    S.assistantReplySchema.parse(await adapters.assistant.ask("Is Mumma’s cataract covered?", "Home"));
    S.inviteResultSchema.parse(await adapters.invite.invite({ relation: "Father", name: "Father", mobile: "+91 98765 43210", via: "whatsapp" }));
    S.walletPassSchema.parse(await adapters.wallet.pass(adapters.wallet.detect()));
    S.notifyResultSchema.parse(await adapters.notify.send("whatsapp", "Renewal"));
    S.authResultSchema.parse(await adapters.auth.sendOtp("+91 98765 43210"));
  });
  it("voice is unsupported in the mock and says so", async () => {
    expect(adapters.voice.supported()).toBe(false);
    await expect(adapters.voice.listen()).rejects.toThrow("VOICE_UNSUPPORTED");
  });
});
