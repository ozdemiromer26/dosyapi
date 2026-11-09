import type { Ctx, Vals } from "./types";
import { buildContext } from "./context";
import { buildSystem } from "./system";
import { buildProjects } from "./projects";
import { buildApprovals } from "./approvals";
import { buildRecords } from "./records";
import { buildTasks } from "./tasks";
import { buildUsers } from "./users";
import { buildShell } from "./shell";
import { buildMaster } from "./master";
import { buildProfile } from "./profile";
import { buildDetail } from "./detail";
import { buildServerFiles } from "./serverFiles";
import { buildTemplates } from "./templates";
import { buildCompany } from "./company";
import { buildAuth } from "./auth";
import { buildSheets } from "./sheets";

/** Tüm ekranların bağlandığı değerleri üretir. Her özellik kendi modülündedir. */
export function buildVals(app: any): Vals {
  const c: Ctx = { app };
  const finishers = [buildContext(c), buildProjects(c), buildApprovals(c), buildRecords(c), buildTasks(c), buildUsers(c), buildShell(c), buildMaster(c), buildProfile(c), buildDetail(c), buildServerFiles(c), buildTemplates(c), buildCompany(c), buildAuth(c), buildSheets(c), buildSystem(c)];
  return Object.assign({}, ...finishers.map((finish) => finish()));
}
