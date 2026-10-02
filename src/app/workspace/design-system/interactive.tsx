"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Drawer, Dropdown, Modal, toast } from "@/components/ui/overlay";

/** Live demos of the overlay components on the design-system page. */
export function OverlayDemos() {
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" onClick={() => setModal(true)}>
        Open modal
      </Button>
      <Button variant="secondary" onClick={() => setDrawer(true)}>
        Open drawer
      </Button>
      <Dropdown
        label="Dropdown"
        items={[
          { label: "Duplicate", onSelect: () => toast("Duplicated") },
          { label: "Share link", onSelect: () => toast("Link copied", "info") },
          {
            label: "Archive",
            onSelect: () => toast("Couldn't archive: try again", "error"),
            danger: true,
          },
        ]}
      />
      <Button onClick={() => toast("Report published")}>Show success toast</Button>
      <Button variant="ghost" onClick={() => toast("Payment failed: card declined", "error")}>
        Show error toast
      </Button>
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Approve and send?"
        description="This email goes to Ayesha Khan with an unsubscribe link."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setModal(false);
                toast("Approved and sent");
              }}
            >
              Approve & send
            </Button>
          </>
        }
      >
        Opt-outs and the daily limit are checked again at the moment of sending.
      </Modal>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Task details">
        <p className="text-ink-soft">
          Drawers hold detail without leaving the page: a task, a lead preview or a filter panel.
        </p>
      </Drawer>
    </div>
  );
}
