"use client";

import { useQuery } from "@tanstack/react-query";
import { festivalApi, idempotent, visitorApi } from "@/shared/lib/api";
import { useActivityHistory } from "@/features/activity-history";

export const REUSABLE_STAMP_POINTS = 50;

export type ContainerType = "CUP" | "BOWL" | "TUMBLER";
export type ContainerRentalStatus = "RENTED" | "RETURNED";
export type StampStatus = "WAITING" | "ISSUED";

export const CONTAINER_TYPE_LABEL: Record<ContainerType, string> = {
  CUP: "다회용 컵",
  BOWL: "다회용 식기",
  TUMBLER: "텀블러",
};

export interface ContainerRental {
  id: string;
  rentalCode: string;
  visitorCode: string;
  containerType: ContainerType;
  quantity: number;
  station: string;
  rentedAt: string;
  returnedAt: string | null;
  status: ContainerRentalStatus;
  stampStatus: StampStatus;
  stampPoints: number;
  operatorEmail: string;
}

export interface NewContainerRental {
  visitorCode: string;
  containerType: ContainerType;
  quantity: number;
  station: string;
}


export function useReusableVisitorCode() {
  return useQuery({
    queryKey: ["visitor-activity-profile"],
    queryFn: () => visitorApi<{ visitorCode: string }>("/visitor/activity-profile"),
    refetchInterval: 10_000,
    throwOnError: true,
  }).data?.visitorCode ?? "";
}

export function useReusableContainerRentals(admin = false) {
  return useActivityHistory<ContainerRental>("rentals", admin);
}

export function createContainerRental(input: NewContainerRental) {
  return festivalApi<ContainerRental>("/activities/rentals", idempotent("POST", input));
}

export function completeContainerReturn(rentalId: string) {
  return festivalApi<ContainerRental>(`/activities/rentals/${rentalId}/return`, idempotent("POST"));
}

export function reusableContainerPoints(rentals: ContainerRental[]) {
  return rentals.reduce((total, rental) => total + rental.stampPoints, 0);
}
