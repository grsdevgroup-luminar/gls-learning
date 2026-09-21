"use client";

import { useMyDeliveryPartner } from "@/lib/api/delivery-partner-hooks";
import { PartnerMissingState, PartnerPageLoading, PartnerStatusState } from "../_components/partner-page-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PurchasesTab } from "./_components/purchases-tab";
import { DirectInvitesTab } from "./_components/direct-invites-tab";

/** Everyone who has ever joined through this partner — the two real
 *  enrollment channels (a campaign-code purchase, or a direct invite) each
 *  get their own tab. Campaign *management* lives on its own page
 *  (/delivery-partner/campaigns); this page is about the people. */
export default function PartnerMembers() {
  const { data: partner, isLoading } = useMyDeliveryPartner();

  if (isLoading) return <PartnerPageLoading />;
  if (!partner) return <PartnerMissingState />;
  if (partner.status !== "APPROVED") return <PartnerStatusState status={partner.status} />;

  return (
    <div className="flex h-screen flex-col space-y-6 p-6 md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Members</h1>
        <p className="text-muted-foreground">Everyone who&apos;s joined through a campaign purchase or a direct invite.</p>
      </div>

      <Tabs defaultValue="purchases" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="shrink-0">
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="direct-invites">Direct invites</TabsTrigger>
        </TabsList>

        <TabsContent value="purchases" className="min-h-0 flex-1 overflow-y-auto pt-4">
          <PurchasesTab />
        </TabsContent>

        <TabsContent value="direct-invites" className="min-h-0 flex-1 overflow-y-auto pt-4">
          <DirectInvitesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
