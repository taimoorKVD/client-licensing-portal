"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { PORTAL_AS_OF } from "@/lib/dates";
import {
  isPersonaId,
  personaById,
  type ActivityItem,
  type License,
  type LicenseDocument,
  type LicenseStatus,
  type Location,
  type Organization,
  type Persona,
  type PersonaId,
  type PortalSnapshot,
} from "@/lib/domain";
import { commitImport, type ImportSummary } from "@/lib/import/commit";
import type { MappedLicense } from "@/lib/import/validate";
import { seedSnapshot } from "@/lib/seed";

const STORAGE_KEY = "cml.portal.snapshot.v1";
const PERSONA_KEY = "cml.portal.persona.v1";

const listeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedSnapshot: PortalSnapshot = seedSnapshot;
let cachedPersonaRaw: string | null = null;
let cachedPersona: PersonaId = "cml_admin";
let personaCacheReady = false;

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === PERSONA_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function readSnapshot(): PortalSnapshot {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    cachedRaw = null;
    cachedSnapshot = seedSnapshot;
    return seedSnapshot;
  }
  if (raw === cachedRaw) return cachedSnapshot;
  try {
    const parsed = JSON.parse(raw) as PortalSnapshot;
    if (
      !parsed ||
      !Array.isArray(parsed.organizations) ||
      !Array.isArray(parsed.locations) ||
      !Array.isArray(parsed.licenses) ||
      !Array.isArray(parsed.documents) ||
      !Array.isArray(parsed.activity)
    ) {
      return seedSnapshot;
    }
    cachedRaw = raw;
    cachedSnapshot = parsed;
    return parsed;
  } catch {
    return seedSnapshot;
  }
}

function readPersona(): PersonaId {
  const raw = window.localStorage.getItem(PERSONA_KEY);
  if (personaCacheReady && raw === cachedPersonaRaw) return cachedPersona;
  cachedPersonaRaw = raw;
  cachedPersona = isPersonaId(raw) ? raw : "cml_admin";
  personaCacheReady = true;
  return cachedPersona;
}

function writeSnapshot(next: PortalSnapshot) {
  const raw = JSON.stringify(next);
  window.localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedSnapshot = next;
  emit();
}

function writePersona(id: PersonaId) {
  window.localStorage.setItem(PERSONA_KEY, id);
  cachedPersonaRaw = id;
  cachedPersona = id;
  personaCacheReady = true;
  emit();
}

function getSnapshot() {
  return readSnapshot();
}

function getServerSnapshot() {
  return seedSnapshot;
}

function getPersonaSnapshot() {
  return readPersona();
}

function getPersonaServerSnapshot(): PersonaId {
  return "cml_admin";
}

type PortalContextValue = {
  persona: Persona;
  isAdmin: boolean;
  setPersona: (id: PersonaId) => void;
  organizations: Organization[];
  locations: Location[];
  licenses: License[];
  documents: LicenseDocument[];
  activity: ActivityItem[];
  organizationById: (id: string) => Organization | undefined;
  locationById: (id: string) => Location | undefined;
  licenseById: (id: string) => License | undefined;
  documentsFor: (licenseId: string) => LicenseDocument[];
  updateLicenseStatus: (id: string, status: LicenseStatus) => void;
  importRows: (rows: MappedLicense[]) => ImportSummary;
  resetDemo: () => void;
};

const PortalContext = createContext<PortalContextValue | null>(null);

export function PortalProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const personaId = useSyncExternalStore(
    subscribe,
    getPersonaSnapshot,
    getPersonaServerSnapshot,
  );
  const persona = personaById(personaId);
  const isAdmin = persona.role === "cml_admin";

  const value = useMemo<PortalContextValue>(() => {
    const organizationId = persona.organizationId;
    const inScope = (id: string) => isAdmin || id === organizationId;
    const organizations = snapshot.organizations.filter((item) => inScope(item.id));
    const locations = snapshot.locations.filter((item) => inScope(item.organizationId));
    const licenses = snapshot.licenses.filter((item) => inScope(item.organizationId));
    const documents = snapshot.documents.filter((item) => inScope(item.organizationId));
    const activity = snapshot.activity.filter(
      (item) => isAdmin || item.organizationId === organizationId,
    );

    return {
      persona,
      isAdmin,
      setPersona: writePersona,
      organizations,
      locations,
      licenses,
      documents,
      activity,
      organizationById: (id) => organizations.find((item) => item.id === id),
      locationById: (id) => locations.find((item) => item.id === id),
      licenseById: (id) => licenses.find((item) => item.id === id),
      documentsFor: (licenseId) => documents.filter((item) => item.licenseId === licenseId),
      updateLicenseStatus: (id, status) => {
        if (!isAdmin) return;
        const current = readSnapshot();
        const target = current.licenses.find((item) => item.id === id);
        if (!target || target.status === status) return;
        writeSnapshot({
          ...current,
          licenses: current.licenses.map((item) =>
            item.id === id ? { ...item, status } : item,
          ),
          activity: [
            {
              id: `act_${Date.now().toString(36)}`,
              at: PORTAL_AS_OF,
              title: "Status updated",
              detail: `${target.licenseNumber} marked ${status}.`,
              organizationId: target.organizationId,
            },
            ...current.activity,
          ],
        });
      },
      importRows: (rows) => {
        if (!isAdmin) {
          throw new Error("Only a CML admin can import a roster.");
        }
        const result = commitImport(readSnapshot(), rows, {
          on: PORTAL_AS_OF,
          createId: (prefix) =>
            `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        });
        writeSnapshot(result.snapshot);
        return result.summary;
      },
      resetDemo: () => {
        window.localStorage.removeItem(STORAGE_KEY);
        cachedRaw = null;
        cachedSnapshot = seedSnapshot;
        emit();
      },
    };
  }, [isAdmin, persona, snapshot]);

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal() {
  const value = useContext(PortalContext);
  if (!value) throw new Error("usePortal must be used inside PortalProvider");
  return value;
}
