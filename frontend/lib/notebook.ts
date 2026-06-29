// Parse a Jupyter .ipynb and infer a distributed-training spec from it. The
// notebook is the requester's "what to run"; we read its code cells and detect
// the base model, LoRA rank, dataset, and epoch budget so the job that fans out
// across the mesh matches what they uploaded.

export interface NotebookCell {
  type: "code" | "markdown" | "raw"
  source: string
}

export interface ParsedNotebook {
  title: string
  cells: NotebookCell[]
  codeLines: number
  // inferred training spec
  baseModel: string
  rank: number
  epochs: number
  dataset: string
  framework: string
}

function joinSource(src: unknown): string {
  if (Array.isArray(src)) return src.join("")
  if (typeof src === "string") return src
  return ""
}

const MODEL_PATTERNS = [
  /from_pretrained\(\s*["']([^"']+)["']/,
  /model_name(?:_or_path)?\s*=\s*["']([^"']+)["']/,
  /AutoModel\w*\.from_pretrained\(\s*["']([^"']+)["']/,
  /["']([\w.-]+\/[\w.-]+(?:-?\d+\.?\d*[bB])?)["']/, // org/model style
]

function detect(code: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = code.match(p)
    if (m?.[1]) return m[1]
  }
  return null
}

function detectFramework(code: string): string {
  if (/\bpeft\b|LoraConfig|get_peft_model/.test(code)) return "PEFT / LoRA"
  if (/transformers|AutoModel|Trainer\b/.test(code)) return "🤗 Transformers"
  if (/torch\.|nn\.Module/.test(code)) return "PyTorch"
  return "Python"
}

/** Best-effort parse; throws only on completely unreadable JSON. */
export function parseNotebook(text: string, filename?: string): ParsedNotebook {
  const nb = JSON.parse(text) as { cells?: unknown[] }
  const rawCells = Array.isArray(nb.cells) ? nb.cells : []
  const cells: NotebookCell[] = rawCells.map((c) => {
    const cell = c as { cell_type?: string; source?: unknown }
    const type = cell.cell_type === "code" ? "code" : cell.cell_type === "markdown" ? "markdown" : "raw"
    return { type, source: joinSource(cell.source) }
  })

  const code = cells.filter((c) => c.type === "code").map((c) => c.source).join("\n")
  const codeLines = code.split("\n").filter((l) => l.trim()).length

  // Title: first markdown heading, else filename, else a default.
  const mdTitle = cells.find((c) => c.type === "markdown" && /^#\s/m.test(c.source))?.source.match(/^#\s+(.+)$/m)?.[1]
  const title = (mdTitle || filename?.replace(/\.ipynb$/, "") || "Notebook fine-tune").trim()

  const baseModel = detect(code, MODEL_PATTERNS) || "meta-llama/Llama-3.1-8B"
  const rankRaw = code.match(/(?:lora_)?r(?:ank)?\s*=\s*(\d+)/i)?.[1]
  const rank = rankRaw ? Math.min(256, Math.max(1, parseInt(rankRaw, 10))) : 16
  const epochsRaw = code.match(/(?:num_train_epochs|epochs)\s*=\s*(\d+)/i)?.[1]
  const epochs = epochsRaw ? Math.min(100, Math.max(1, parseInt(epochsRaw, 10))) : 3
  const dataset =
    detect(code, [/load_dataset\(\s*["']([^"']+)["']/, /dataset(?:_name|_path)?\s*=\s*["']([^"']+)["']/]) ||
    "tatsu-lab/alpaca"
  const framework = detectFramework(code)

  return { title, cells, codeLines, baseModel, rank, epochs, dataset, framework }
}

// A realistic LoRA fine-tune notebook so the demo always has something to submit
// even without a file on hand.
export const SAMPLE_NOTEBOOK = JSON.stringify({
  cells: [
    { cell_type: "markdown", source: ["# LoRA fine-tune: customer-support assistant\n", "Distributed across the Mycelia mesh."] },
    { cell_type: "code", source: ["!pip install -q transformers peft datasets accelerate"] },
    {
      cell_type: "code",
      source: [
        "from transformers import AutoModelForCausalLM, AutoTokenizer\n",
        "from peft import LoraConfig, get_peft_model\n",
        "from datasets import load_dataset\n",
        "\n",
        'model_name = "meta-llama/Llama-3.1-8B"\n',
        "model = AutoModelForCausalLM.from_pretrained(model_name)\n",
        "tok = AutoTokenizer.from_pretrained(model_name)",
      ],
    },
    {
      cell_type: "code",
      source: [
        'ds = load_dataset("tatsu-lab/alpaca", split="train")\n',
        "lora = LoraConfig(r=16, lora_alpha=32, target_modules=[\"q_proj\",\"v_proj\"], lora_dropout=0.05)\n",
        "model = get_peft_model(model, lora)",
      ],
    },
    {
      cell_type: "code",
      source: [
        "from transformers import TrainingArguments, Trainer\n",
        'args = TrainingArguments(output_dir="out", num_train_epochs=3, per_device_train_batch_size=8, learning_rate=2e-4)\n',
        "trainer = Trainer(model=model, args=args, train_dataset=ds)\n",
        "trainer.train()",
      ],
    },
  ],
  metadata: { kernelspec: { name: "python3", display_name: "Python 3" } },
  nbformat: 4,
  nbformat_minor: 5,
}, null, 1)
