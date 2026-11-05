import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getAccountService } from "@/domain/accounts";
import { getCaseService } from "@/domain/cases";
import { getVehicleService } from "@/domain/vehicles";

import { saveVehicleAction } from "../actions";
import { VehicleForm } from "./vehicle-form";
import { VehicleSearch } from "./vehicle-search";

export const metadata: Metadata = {
  title: "Vehicle",
};

/** Vehicle tab (UC-10). */
export default function VehicleTabPage({ params }: PageProps<"/cases/[id]/vehicle">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <VehicleTab params={params} />
    </Suspense>
  );
}

async function VehicleTab({ params }: Pick<PageProps<"/cases/[id]/vehicle">, "params">) {
  const { id } = await params;
  const [cases, vehicles, accounts] = await Promise.all([getCaseService(), getVehicleService(), getAccountService()]);
  const detail = await cases.get(id);
  if (!detail) {
    notFound();
  }
  const [vehicle, accountOptions] = await Promise.all([
    detail.vehicle ? vehicles.get(detail.vehicle.id) : null,
    accounts.listTypedOptions(),
  ]);
  const options = (type: "client" | "leasing_company") =>
    accountOptions
      .filter((account) => account.accountTypes.includes(type))
      .map((account) => ({ value: account.id, label: account.name }));

  return (
    <div className="grid gap-6">
      {vehicle ? null : <VehicleSearch caseId={detail.id} />}
      <VehicleForm
        action={saveVehicleAction.bind(null, detail.id)}
        vehicleId={vehicle?.id ?? null}
        stored={
          vehicle
            ? Object.fromEntries(Object.entries(vehicle).map(([key, value]) => [key, value?.toString() ?? null]))
            : {}
        }
        owners={options("client")}
        leasingCompanies={options("leasing_company")}
      />
    </div>
  );
}
