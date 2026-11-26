"use client";

import { useTransition } from "react";
import { archiveClient } from "@/app/(app)/clients/actions";
import { btn } from "./ui";

export function ArchiveClientButton({
  clientId,
  archived,
  name,
}: {
  clientId: string;
  archived: boolean;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={btn.ghost}
      aria-label={`${archived ? "Restore" : "Archive"} ${name}`}
      onClick={() =>
        startTransition(async () => {
          const result = await archiveClient(clientId, !archived);
          if (!result.ok) alert(result.error);
        })
      }
    >
      {archived ? "Restore" : "Archive"}
    </button>
  );
}
