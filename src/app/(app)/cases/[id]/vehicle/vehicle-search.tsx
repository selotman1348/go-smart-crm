"use client";

import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { linkVehicleAction, searchVehiclesAction, type VehicleSearchState } from "../actions";

/** Finds a vehicle that is already known (one plate can have several cases) and links it. */
export function VehicleSearch({ caseId }: { caseId: string }) {
  const [state, formAction, searching] = useActionState<VehicleSearchState, FormData>(searchVehiclesAction, {
    term: "",
  });
  const [linking, startLinking] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section aria-labelledby="find-vehicle" className="grid gap-3 rounded-lg border p-4">
      <h2 id="find-vehicle" className="text-sm font-medium">
        Find vehicle
      </h2>
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <div className="grid gap-2">
          <Label htmlFor="vehicle-term">Licence plate or VIN</Label>
          <Input id="vehicle-term" name="term" defaultValue={state.term} className="w-64" />
        </div>
        <Button type="submit" variant="secondary" disabled={searching}>
          {searching ? "Searching…" : "Search"}
        </Button>
      </form>
      {state.matches ? (
        state.matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No vehicle found. Enter its details below to add it.
          </p>
        ) : (
          <ul className="grid gap-2">
            {state.matches.map((match) => (
              <li key={match.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                <span className="text-sm">
                  <span className="font-mono font-medium">{match.licencePlate}</span>
                  {" · "}
                  {[match.make, match.model].filter(Boolean).join(" ") || "Unknown model"}
                  {match.vin ? <span className="font-mono text-muted-foreground"> · {match.vin}</span> : null}
                </span>
                <Button
                  type="button"
                  size="sm"
                  disabled={linking}
                  onClick={() =>
                    startLinking(async () => {
                      const result = await linkVehicleAction(caseId, match.id);
                      setError(result.ok ? null : result.error);
                    })
                  }
                >
                  Use this vehicle
                </Button>
              </li>
            ))}
          </ul>
        )
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
