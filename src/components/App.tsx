import React, { useState, useEffect } from "react";
import { useApp, useInput, useStdin } from "ink";
import { StateProvider, useAppState, useDispatch } from "../state.js";
import { DashboardView } from "./DashboardView.js";
import { DetailView } from "./DetailView.js";
import { LogView } from "./LogView.js";
import { AlertBanner } from "./AlertBanner.js";
import { evaluateAlerts } from "../alerts/engine.js";

type View = "dashboard" | "detail" | "log";

export interface AppOptions {
  command: "dashboard" | "status" | "log" | "check";
  json: boolean;
  watch: boolean;
  errors: boolean;
}

function AppContent({ options }: { options: AppOptions }): React.ReactElement {
  const [view, setView] = useState<View>("dashboard");
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const state = useAppState();
  const dispatch = useDispatch();

  // Evaluate alerts on state changes
  useEffect(() => {
    const alerts = evaluateAlerts(state);
    dispatch({ type: "SET_ALERTS", payload: alerts });
  }, [state.processes, state.syncStatus, state.systemInfo]);

  useInput(
    (input) => {
      if (view === "dashboard") {
        if (input === "d") setView("detail");
        if (input === "l") setView("log");
        if (input === "q") exit();
      }
    },
    { isActive: isRawModeSupported },
  );

  return (
    <>
      <AlertBanner />
      {view === "dashboard" && <DashboardView />}
      {view === "detail" && (
        <DetailView onBack={() => setView("dashboard")} />
      )}
      {view === "log" && (
        <LogView onBack={() => setView("dashboard")} />
      )}
    </>
  );
}

export function App({ options }: { options: AppOptions }): React.ReactElement {
  return (
    <StateProvider>
      <AppContent options={options} />
    </StateProvider>
  );
}
