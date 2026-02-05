export type Organization = {
  id: string;
  name: string;
  plan: string;
  created_at: string;
};

export type Profile = {
  id: string;
  organization_id: string | null;
  email: string;
  name: string | null;
  department: string | null;
  role: "admin" | "manager" | "user";
  phone: string | null;
  created_at: string;
};

export type Asset = {
  id: string;
  short_id: string | null;
  organization_id: string | null;
  created_at: string;
  name: string;
  model_name: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  category: "sound" | "video" | "kitchen" | "furniture" | "etc" | null;
  owner_scope: "organization" | "department";
  owner_department: string;
  location: string | null;
  quantity: number;
  status: "available" | "rented" | "repair" | "lost" | "retired";
  shopping_link: string | null;
  ai_metadata: Record<string, unknown> | null;
  is_verified: boolean;
  tags: string[] | null;
  purchase_date: string | null;
  purchase_price: number | null;
  useful_life_years: number | null;
  last_used_at: string | null;
  mobility: "fixed" | "movable" | null;
  loanable: boolean | null;
  usable_until: string | null;
  managed_by_department: string | null;
  deleted_at: string | null;
  deletion_reason: string | null;
};

export type Reservation = {
  id: string;
  organization_id: string | null;
  created_at: string;
  asset_id: string;
  borrower_id: string;
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "returned" | "rejected";
  note: string | null;
  recurrence_type: "none" | "weekly" | "monthly" | null;
  recurrence_interval: number | null;
  recurrence_end_date: string | null;
  recurrence_days_of_week: number[] | null; // 0=일요일, 1=월요일, ..., 6=토요일
  recurrence_day_of_month: number | null; // 1-31
  parent_reservation_id: string | null;
  is_recurring_instance: boolean | null;
  // Return verification fields
  return_images: string[] | null;
  return_status: "pending" | "returned" | "verified" | "rejected" | null;
  return_note: string | null;
  return_verified_by: string | null;
  return_verified_at: string | null;
  return_condition: string | null; // 'good', 'damaged', 'missing_parts', etc.
};

export type Space = {
  id: string;
  short_id: string | null;
  organization_id: string | null;
  created_at: string;
  name: string;
  image_url: string | null;
  image_urls: string[] | null;
  category: string | null;
  owner_scope: "organization" | "department";
  owner_department: string;
  location: string | null;
  capacity: number | null;
  status: "available" | "rented" | "repair" | "lost";
  note: string | null;
  managed_by_department: string | null;
};

export type Vehicle = {
  id: string;
  short_id: string | null;
  organization_id: string | null;
  created_at: string;
  name: string;
  image_url: string | null;
  image_urls: string[] | null;
  category: string | null;
  owner_scope: "organization" | "department";
  owner_department: string;
  location: string | null;
  status: "available" | "rented" | "repair" | "lost";
  note: string | null;
  managed_by_department: string | null;
  license_plate: string | null;
  vehicle_type: string | null;
  fuel_type: string | null;
  capacity: number | null;
  current_odometer: number | null; // 현재 주행거리 (km)
};

export type VehicleReservation = {
  id: string;
  organization_id: string | null;
  created_at: string;
  vehicle_id: string;
  borrower_id: string;
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "returned" | "rejected";
  note: string | null;
  recurrence_type: "none" | "weekly" | "monthly" | null;
  recurrence_interval: number | null;
  recurrence_end_date: string | null;
  recurrence_days_of_week: number[] | null;
  recurrence_day_of_month: number | null;
  parent_reservation_id: string | null;
  is_recurring_instance: boolean | null;
  // Return verification fields
  return_images: string[] | null;
  return_status: "pending" | "returned" | "verified" | "rejected" | null;
  return_note: string | null;
  return_verified_by: string | null;
  return_verified_at: string | null;
  return_condition: string | null;
  // Vehicle-specific return fields
  vehicle_odometer_image: string | null; // 계기판 사진
  vehicle_exterior_image: string | null; // 외관 사진
  odometer_reading: number | null; // 반납 시 최종 주행거리
  start_odometer_reading: number | null; // 대여 시 초기 주행거리
  distance_traveled: number | null; // 실제 운행거리 (최종 - 초기)
};

export type VehicleReservationSummary = {
  id: string;
  status: VehicleReservation["status"];
  start_date: string;
  end_date: string;
  borrower_id: string;
  note: string | null;
  borrower?: {
    id: string;
    name: string | null;
    department: string | null;
  } | null;
};

export type SpaceReservation = {
  id: string;
  organization_id: string | null;
  created_at: string;
  space_id: string;
  borrower_id: string;
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "returned" | "rejected";
  note: string | null;
  recurrence_type: "none" | "weekly" | "monthly" | null;
  recurrence_interval: number | null;
  recurrence_end_date: string | null;
  recurrence_days_of_week: number[] | null; // 0=일요일, 1=월요일, ..., 6=토요일
  recurrence_day_of_month: number | null; // 1-31
  parent_reservation_id: string | null;
  is_recurring_instance: boolean | null;
  // Return verification fields
  return_images: string[] | null;
  return_status: "pending" | "returned" | "verified" | "rejected" | null;
  return_note: string | null;
  return_verified_by: string | null;
  return_verified_at: string | null;
  return_condition: string | null;
};

export type ApprovalPolicy = {
  id: string;
  organization_id: string | null;
  scope: "asset" | "space" | "vehicle";
  department: string | null;
  required_role: "admin" | "manager" | "user";
  created_at: string;
};

export type Notification = {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  channel: "kakao" | "email";
  type: string;
  status: "pending" | "sent" | "failed";
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export type AuditLog = {
  id: string;
  organization_id: string | null;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type OrganizationInvite = {
  id: string;
  organization_id: string | null;
  email: string;
  role: "admin" | "manager" | "user";
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type AssetTransferRequest = {
  id: string;
  organization_id: string | null;
  asset_id: string | null;
  requester_id: string | null;
  from_department: string | null;
  to_department: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  note: string | null;
  created_at: string;
  resolved_at: string | null;
};
