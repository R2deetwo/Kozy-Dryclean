import type { Metadata } from "next";
import { FeedbackPage } from "@/components/customer/feedback-page";

export const metadata: Metadata = {
  title: "Feedback — Kozy Care",
  description:
    "Review your Kozy Care order (verified by order number) or send the team a complaint or question. Reviews are tied to completed orders and moderated before appearing on our testimonials wall.",
};

export default function Feedback() {
  return <FeedbackPage />;
}
