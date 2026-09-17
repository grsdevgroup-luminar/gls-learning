"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api/endpoints";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApplicationsTab } from "./_components/applications-tab";
import { PartnersTab } from "./_components/partners-tab";

export default function AdminDeliveryPartners() {
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["admin", "delivery-partner-application-stats"],
    queryFn: () => adminApi.deliveryPartnerApplicationStats(),
  });

  return (
    <div className="flex h-screen flex-col space-y-6 p-6 md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Delivery Partners</h1>
        <p className="text-muted-foreground">Review applications and manage your worldwide delivery partner network.</p>
      </div>

      <Tabs defaultValue="applications" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="shrink-0">
          <TabsTrigger value="applications">
            Applications
            {!!stats?.pending && (
              <Badge variant="outline" className="ml-1.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] text-warning border-warning/30 bg-warning/10">
                {stats.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="partners">Partners</TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="flex min-h-0 flex-1 flex-col gap-4 pt-4">
          <ApplicationsTab
            onMutated={() => {
              qc.invalidateQueries({ queryKey: ["admin", "delivery-partner-applications"] });
              qc.invalidateQueries({ queryKey: ["admin", "delivery-partner-application-stats"] });
              qc.invalidateQueries({ queryKey: ["admin", "delivery-partners"] });
            }}
          />
        </TabsContent>

        <TabsContent value="partners" className="flex min-h-0 flex-1 flex-col gap-4 pt-4">
          <PartnersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
