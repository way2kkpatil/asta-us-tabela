import type { SymbolCombineRule } from "../shared/combine-symbols.js";

export function createSettingsDialog(options: {
  onSave: (rules: SymbolCombineRule[]) => void;
  getSuggestions: () => SymbolCombineRule[];
}): {
  open: (rules: SymbolCombineRule[]) => void;
} {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop hidden";
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="combine-dialog-title">
      <div class="modal-header">
        <h2 id="combine-dialog-title">Symbol Combine Rules</h2>
        <button type="button" class="icon-button modal-close" aria-label="Close settings">×</button>
      </div>
      <p class="modal-copy">
        Combine multiple share classes into one output symbol. Disabled rules are kept but not applied.
      </p>
      <div class="combine-rules" id="combine-rules"></div>
      <div class="modal-toolbar">
        <button type="button" id="add-combine-rule">Add rule</button>
        <button type="button" class="secondary-button" id="load-suggestions">Load detected pairs</button>
      </div>
      <div class="modal-actions">
        <button type="button" class="secondary-button" id="cancel-combine-rules">Cancel</button>
        <button type="button" id="save-combine-rules">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const rulesContainer = backdrop.querySelector<HTMLElement>("#combine-rules")!;
  const addButton = backdrop.querySelector<HTMLButtonElement>("#add-combine-rule")!;
  const suggestionsButton = backdrop.querySelector<HTMLButtonElement>(
    "#load-suggestions",
  )!;
  const saveButton = backdrop.querySelector<HTMLButtonElement>(
    "#save-combine-rules",
  )!;
  const cancelButton = backdrop.querySelector<HTMLButtonElement>(
    "#cancel-combine-rules",
  )!;
  const closeButton = backdrop.querySelector<HTMLButtonElement>(".modal-close")!;

  let draftRules: SymbolCombineRule[] = [];
  let savedRules: SymbolCombineRule[] = [];

  function parseSources(value: string): string[] {
    return value
      .split(/[,\s]+/)
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean);
  }

  function readRulesFromForm(): SymbolCombineRule[] {
    return [...rulesContainer.querySelectorAll<HTMLElement>(".combine-rule-row")]
      .map((row) => {
        const sourcesInput = row.querySelector<HTMLInputElement>(".rule-sources")!;
        const outputInput = row.querySelector<HTMLInputElement>(".rule-output")!;
        const enabledInput = row.querySelector<HTMLInputElement>(".rule-enabled")!;
        const id = row.dataset.ruleId || crypto.randomUUID();

        return {
          id,
          sources: parseSources(sourcesInput.value),
          output: outputInput.value.trim().toUpperCase(),
          enabled: enabledInput.checked,
        };
      })
      .filter((rule) => rule.sources.length > 0 && rule.output);
  }

  function renderRuleRows(): void {
    rulesContainer.innerHTML = "";

    if (draftRules.length === 0) {
      rulesContainer.innerHTML =
        '<p class="empty-rules">No combine rules yet. Add a row or load detected pairs.</p>';
      return;
    }

    for (const rule of draftRules) {
      const row = document.createElement("div");
      row.className = `combine-rule-row${rule.enabled ? "" : " is-disabled"}`;
      row.dataset.ruleId = rule.id;
      row.innerHTML = `
        <label class="rule-enabled-wrap">
          <input class="rule-enabled" type="checkbox" ${rule.enabled ? "checked" : ""} />
          <span>On</span>
        </label>
        <div class="field">
          <label>Source symbols</label>
          <input class="rule-sources" type="text" placeholder="GOOG, GOOGL" autocomplete="off" />
        </div>
        <div class="field">
          <label>Output symbol</label>
          <input class="rule-output" type="text" placeholder="GOOG" autocomplete="off" />
        </div>
        <button type="button" class="icon-button remove-rule" aria-label="Remove rule">×</button>
      `;

      const sourcesInput = row.querySelector<HTMLInputElement>(".rule-sources")!;
      const outputInput = row.querySelector<HTMLInputElement>(".rule-output")!;
      const enabledInput = row.querySelector<HTMLInputElement>(".rule-enabled")!;

      sourcesInput.value = rule.sources.join(", ");
      outputInput.value = rule.output;

      enabledInput.addEventListener("change", () => {
        row.classList.toggle("is-disabled", !enabledInput.checked);
      });

      row.querySelector(".remove-rule")?.addEventListener("click", () => {
        draftRules = readRulesFromForm().filter((item) => item.id !== rule.id);
        renderRuleRows();
      });

      rulesContainer.appendChild(row);
    }
  }

  function close(): void {
    backdrop.classList.add("hidden");
    draftRules = structuredClone(savedRules);
  }

  function open(rules: SymbolCombineRule[]): void {
    savedRules = structuredClone(rules);
    draftRules = structuredClone(rules);
    renderRuleRows();
    backdrop.classList.remove("hidden");
  }

  addButton.addEventListener("click", () => {
    draftRules = [
      ...readRulesFromForm(),
      { id: crypto.randomUUID(), sources: [], output: "", enabled: true },
    ];
    renderRuleRows();
  });

  suggestionsButton.addEventListener("click", () => {
    const existing = new Set(
      readRulesFromForm().flatMap((rule) =>
        rule.sources.map((symbol) => symbol.toUpperCase()),
      ),
    );
    const suggestions = options
      .getSuggestions()
      .filter((rule) =>
        rule.sources.every((symbol) => !existing.has(symbol.toUpperCase())),
      );

    draftRules = [...readRulesFromForm(), ...suggestions];
    renderRuleRows();
  });

  saveButton.addEventListener("click", () => {
    const nextRules = readRulesFromForm();
    savedRules = structuredClone(nextRules);
    options.onSave(nextRules);
    close();
  });

  cancelButton.addEventListener("click", close);
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      close();
    }
  });

  return { open };
}
