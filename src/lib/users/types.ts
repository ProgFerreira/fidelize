import type { StaffRoleCode } from "@/lib/auth/permissions";

export type StaffUserStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";

export type StaffUserDTO = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: StaffUserStatus;
  roleId: string;
  roleCode: string;
  roleName: string;
  unitId: string | null;
  unitName: string | null;
  lastLoginAt: string | null;
  mfaEnabled: boolean;
};

export type StaffRoleOption = {
  id: string;
  code: StaffRoleCode;
  name: string;
};

export type StaffUnitOption = {
  id: string;
  name: string;
};
