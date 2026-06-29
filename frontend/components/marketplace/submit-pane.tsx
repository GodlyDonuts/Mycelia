"use client"

import { useState } from "react"
import { FileJson, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { NotebookSubmit } from "./notebook-submit"
import { SubmitJob } from "./submit-job"

type Tab = "notebook" | "spec"

export function SubmitPane() {
  const [tab, setTab] = useState<Tab>("notebook")
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-secondary/40 p-1">
        <button
          onClick={() => setTab("notebook")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            tab === "notebook" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <FileJson className="size-4" strokeWidth={1.75} /> Jupyter notebook
        </button>
        <button
          onClick={() => setTab("spec")}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            tab === "spec" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <SlidersHorizontal className="size-4" strokeWidth={1.75} /> Job spec
        </button>
      </div>

      {tab === "notebook" ? <NotebookSubmit /> : <SubmitJob />}
    </div>
  )
}
