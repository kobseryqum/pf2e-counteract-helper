// PF2e Counteract Helper – minimal, V12/V13-friendly
// Adds /counteract command and a small dialog to roll + explain

Hooks.once("init", () => {
  console.log("PF2e Counteract Helper | init");
});

Hooks.on("chatMessage", (chatLog, message, chatData) => {
  if (!message?.trim()?.toLowerCase().startsWith("/counteract")) return;
  openCounteractDialog();
  return false; // prevent normal chat handling
});

function openCounteractDialog() {
  const content = `
  <form>
    <div class="form-group">
      <label>Your Counteract Rank (usually your spell rank):</label>
      <input type="number" name="myRank" value="3" min="0" step="1"/>
    </div>
    <div class="form-group">
      <label>Your Counteract Modifier (spell atk prof + ability + bonuses):</label>
      <input type="number" name="myMod" value="12" step="1"/>
    </div>
    <hr/>
    <div class="form-group">
      <label>Target DC (caster DC, affliction DC, or GM-calculated):</label>
      <input type="number" name="targetDC" value="22" step="1"/>
    </div>
    <div class="form-group">
      <label>Target Counteract Rank (see notes):</label>
      <input type="number" name="targetRank" value="3" min="0" step="1"/>
    </div>
    <p style="margin-top:6px;font-size:12px;opacity:.85">
      Notes: If the effect is a <b>spell</b>, its <i>spell rank</i> is the counteract rank. If it’s <b>not</b> a spell, use <i>ceil(level / 2)</i> (min 0). If unclear and it came from a creature, use <i>ceil(creature level / 2)</i>.
    </p>
  </form>`;

  new Dialog({
    title: "PF2e Counteract Check",
    content,
    buttons: {
      roll: {
        label: "Roll Counteract",
        callback: async (html) => {
          const myRank = Number(html.find('input[name="myRank"]').val());
          const myMod = Number(html.find('input[name="myMod"]').val());
          const targetDC = Number(html.find('input[name="targetDC"]').val());
          const targetRank = Number(html.find('input[name="targetRank"]').val());
          await doCounteractRoll({ myRank, myMod, targetDC, targetRank });
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "roll"
  }).render(true);
}

async function doCounteractRoll({ myRank, myMod, targetDC, targetRank }) {
  const roll = await (new Roll("1d20 + @mod", { mod: myMod })).evaluate({ async: true });
const total = roll.total;
  const outcome = degreeOfSuccess(total, targetDC); // "criticalSuccess" | "success" | "failure" | "criticalFailure"

  // Counteract rules (Player Core)
  // CS: can counteract if targetRank <= myRank + 3
  // S:  can counteract if targetRank <= myRank + 1
  // F:  can counteract if targetRank <  myRank
  // CF: never
  let works = false;
  let thresholdText = "";

  const diff = targetRank - myRank;

  if (outcome === "criticalSuccess") {
    works = diff <= 3;
    thresholdText = "Critical Success allows counteracting targets up to 3 ranks higher than your effect.";
  } else if (outcome === "success") {
    works = diff <= 1;
    thresholdText = "Success allows counteracting targets up to 1 rank higher than your effect.";
  } else if (outcome === "failure") {
    works = diff < 0;
    thresholdText = "Failure only counteracts targets with lower rank than your effect.";
  } else {
    works = false;
    thresholdText = "Critical Failure never counteracts.";
  }

  const rows = [
    `<tr><td>Roll</td><td>${roll.result}</td><td>Total ${total}</td></tr>`,
    `<tr><td>Target DC</td><td colspan="2">${targetDC}</td></tr>`,
    `<tr><td>Degree of Success</td><td colspan="2">${dosLabel(outcome)}</td></tr>`,
    `<tr><td>Your Counteract Rank</td><td colspan="2">${myRank}</td></tr>`,
    `<tr><td>Target Counteract Rank</td><td colspan="2">${targetRank} (Δ ${diff >= 0 ? "+"+diff : diff})</td></tr>`
  ].join("");

  const resultLine = works
    ? `<span style="color: var(--color-success, #14866d); font-weight:600;">Counteracted ✔</span>`
    : `<span style="color: var(--color-danger, #c00); font-weight:600;">Not Counteracted ✖</span>`;

  const html = `
  <div class="pf2e-counteract-card">
    <h3 style="margin:0 0 6px 0;">Counteract Check</h3>
    <table style="width:100%;border-collapse:collapse;">
      <tbody>${rows}</tbody>
    </table>
    <hr/>
    <p style="margin:.25rem 0;">${resultLine}</p>
    <p style="margin:.25rem 0; font-size:12px; opacity:.9">${thresholdText}</p>
    <details style="margin-top:.3rem;">
      <summary style="cursor:pointer;">Rules reference (what this card used)</summary>
      <ul style="margin:.25rem 0 0 1rem; font-size:12px;">
        <li>Use appropriate modifier vs the target's DC (affliction DC, caster DC, or GM DC).</li>
        <li>Counteract ranks determine what can be affected on each degree of success.</li>
        <li>If not a spell, rank = ceil(level / 2) (min 0).</li>
      </ul>
      <p style="font-size:11px;opacity:.85;">Source: Player Core, Counteracting.</p>
    </details>
  </div>`;

  await roll.toMessage({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker(),
    flavor: html,
    flags: { "pf2e-counteract-helper": { outcome, myRank, targetRank, targetDC, total } }
  });
}

function degreeOfSuccess(total, dc) {
  if (total >= dc + 10) return "criticalSuccess";
  if (total >= dc) return "success";
  if (total <= dc - 10) return "criticalFailure";
  return "failure";
}

function dosLabel(key) {
  return ({
    criticalSuccess: "Critical Success",
    success: "Success",
    failure: "Failure",
    criticalFailure: "Critical Failure"
  })[key] ?? key;
}
