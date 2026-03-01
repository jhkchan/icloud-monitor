import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { ProcessMonitor, type ProcessStats } from "./collectors/ProcessMonitor.js";
import {
  BrctlStatusPoller,
  type SyncStatus,
} from "./collectors/BrctlStatusPoller.js";
import { BrctlQuotaPoller, type QuotaInfo } from "./collectors/BrctlQuotaPoller.js";
import {
  SystemInfoCollector,
  type SystemInfo,
} from "./collectors/SystemInfoCollector.js";
import { LogStreamer, type LogEvent, type LogStats } from "./collectors/LogStreamer.js";

// State shape
export interface AppState {
  processes: Map<string, ProcessStats>;
  syncStatus: SyncStatus | null;
  quota: QuotaInfo | null;
  systemInfo: SystemInfo | null;
  logEvents: LogEvent[];
  logStats: LogStats;
  initialScanComplete: boolean;
  pollInterval: number;
  alerts: Alert[];
}

export interface Alert {
  id: string;
  message: string;
  command?: string;
  note?: string;
  severity: "warning" | "critical";
  since: Date;
}

type Action =
  | { type: "SET_PROCESSES"; payload: Map<string, ProcessStats> }
  | { type: "SET_SYNC_STATUS"; payload: SyncStatus }
  | { type: "SET_QUOTA"; payload: QuotaInfo }
  | { type: "SET_SYSTEM_INFO"; payload: SystemInfo }
  | { type: "ADD_LOG_EVENTS_BATCH"; payload: LogEvent[] }
  | { type: "SET_LOG_STATS"; payload: LogStats }
  | { type: "SET_INITIAL_SCAN_COMPLETE" }
  | { type: "SET_POLL_INTERVAL"; payload: number }
  | { type: "SET_ALERTS"; payload: Alert[] };

const initialState: AppState = {
  processes: new Map(),
  syncStatus: null,
  quota: null,
  systemInfo: null,
  logEvents: [],
  logStats: { opsPerMinute: 0, errorCount: 0, avgDurationMs: 0 },
  initialScanComplete: false,
  pollInterval: 30_000,
  alerts: [],
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_PROCESSES":
      return { ...state, processes: action.payload };
    case "SET_SYNC_STATUS":
      return {
        ...state,
        syncStatus: action.payload,
        pollInterval: action.payload.scanDurationMs,
      };
    case "SET_QUOTA":
      return { ...state, quota: action.payload };
    case "SET_SYSTEM_INFO":
      return { ...state, systemInfo: action.payload };
    case "ADD_LOG_EVENTS_BATCH":
      return {
        ...state,
        logEvents: [...state.logEvents, ...action.payload].slice(-1000),
      };
    case "SET_LOG_STATS":
      return { ...state, logStats: action.payload };
    case "SET_INITIAL_SCAN_COMPLETE":
      return { ...state, initialScanComplete: true };
    case "SET_POLL_INTERVAL":
      return { ...state, pollInterval: action.payload };
    case "SET_ALERTS":
      return { ...state, alerts: action.payload };
    default:
      return state;
  }
}

const StateContext = createContext<AppState>(initialState);
const DispatchContext = createContext<React.Dispatch<Action>>(() => {});

export function useAppState(): AppState {
  return useContext(StateContext);
}

export function useDispatch(): React.Dispatch<Action> {
  return useContext(DispatchContext);
}

interface StateProviderProps {
  children: ReactNode;
}

export function StateProvider({ children }: StateProviderProps): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, initialState);
  const collectorsRef = useRef<{
    process: ProcessMonitor;
    status: BrctlStatusPoller;
    quota: BrctlQuotaPoller;
    system: SystemInfoCollector;
    log: LogStreamer;
  } | null>(null);

  useEffect(() => {
    const processMonitor = new ProcessMonitor((stats) => {
      dispatch({ type: "SET_PROCESSES", payload: stats });
    });

    const statusPoller = new BrctlStatusPoller((status) => {
      dispatch({ type: "SET_SYNC_STATUS", payload: status });
    });

    const quotaPoller = new BrctlQuotaPoller((quota) => {
      dispatch({ type: "SET_QUOTA", payload: quota });
    });

    const systemInfo = new SystemInfoCollector((info) => {
      dispatch({ type: "SET_SYSTEM_INFO", payload: info });
    });

    const logStreamer = new LogStreamer(
      (events) => dispatch({ type: "ADD_LOG_EVENTS_BATCH", payload: events }),
      (stats) => dispatch({ type: "SET_LOG_STATS", payload: stats }),
    );

    collectorsRef.current = {
      process: processMonitor,
      status: statusPoller,
      quota: quotaPoller,
      system: systemInfo,
      log: logStreamer,
    };

    // Start all collectors
    processMonitor.start();
    quotaPoller.start();
    systemInfo.start();
    logStreamer.start();

    // Status poller is async (first run blocks)
    statusPoller.start().then(() => {
      dispatch({ type: "SET_INITIAL_SCAN_COMPLETE" });
    });

    return () => {
      processMonitor.stop();
      statusPoller.stop();
      quotaPoller.stop();
      systemInfo.stop();
      logStreamer.stop();
    };
  }, []);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}
