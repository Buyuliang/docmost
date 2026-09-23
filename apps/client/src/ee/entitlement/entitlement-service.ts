import api from "@/lib/api-client";
import { Entitlements } from "./entitlement.types";

// 社区版自建功能: 这些特性已在本 fork 中原创实现, 强制解锁(不再显示需付费)
const COMMUNITY_FEATURES = ["api:keys"];

export async function getEntitlements(): Promise<Entitlements> {
  const req = await api.post<Entitlements>("/workspace/entitlements");
  const data = (req.data ?? {}) as Entitlements;
  const features = Array.from(
    new Set([...(data.features ?? []), ...COMMUNITY_FEATURES]),
  );
  return { ...data, features };
}
