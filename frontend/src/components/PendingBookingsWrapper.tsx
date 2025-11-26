"use client";

import { useState } from "react";
import PendingBookingsBanner from "./PendingBookingsBanner";
import PendingBookingsModal from "./PendingBookingsModal";

export default function PendingBookingsWrapper() {
  const [pendingModalOpen, setPendingModalOpen] = useState(false);

  return (
    <>
      <PendingBookingsBanner onOpenModal={() => setPendingModalOpen(true)} />
      <PendingBookingsModal
        isOpen={pendingModalOpen}
        onClose={() => setPendingModalOpen(false)}
      />
    </>
  );
}

