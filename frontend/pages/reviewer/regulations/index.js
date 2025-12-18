"use client";

import React from "react";
import { useAuth } from "../../../contexts/AuthContext";
import Unauthorized from "../../../components/common/Unauthorized";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import ReviewerRegulationsList from "../../../components/reviewer/ReviewerRegulationsList";

/**
 * Reviewer Regulations
 * Reuses the same table section from the Reviewer Dashboard UI.
 * (Keeps navigation simple: Sidebar -> Regulations)
 */
export default function ReviewerRegulationsPage() {
  const { user, isReviewer, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!user) return <LoadingSpinner />;
  if (!isReviewer()) return <Unauthorized />;

  return <ReviewerRegulationsList />;
}
