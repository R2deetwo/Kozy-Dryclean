import type { Metadata } from "next";
import { MeasurementsGuide } from "@/components/customer/measurements-guide";

export const metadata: Metadata = {
  title: "How to Take Your Measurements — Kozy Care",
  description:
    "A free, interactive guide to measuring yourself (or your children) for alterations: where the tape sits, what each measurement means, and how to save your numbers for every future booking.",
};

export default function MeasurementsPage() {
  return <MeasurementsGuide />;
}
