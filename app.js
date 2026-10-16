"use strict";
const versionSelect = document.getElementById("version");
const replaySelect = document.getElementById("replay");
const viewSelect = document.getElementById("view");
const viewSwitch = document.getElementById("view-switch");
const video = document.getElementById("video");
const empty = document.getElementById("empty");
const title = document.getElementById("title");
const status = document.getElementById("status");
const description = document.getElementById("description");
const metrics = document.getElementById("metrics");
const evaluationNote = document.getElementById("evaluation-note");
const compareSelect = document.getElementById("compare");
const catalogStatus = document.getElementById("catalog-status");
let manifest = [];
let activeBlobUrl = null;
let loadGeneration = 0;
let catalogGeneration = 0;

const stateLabels = {queued:"Pendente", running:"Em execução", succeeded:"Concluído",
  failed:"Falhou", interrupted:"Interrompido", skipped:"Não executado", missing:"Indisponível",
  blocked_token:"Aguardando credencial", submitted:"Disponível neste catálogo", verified:"Verificado"};
const phaseLabels = {training:"Treinamento", evaluation:"Avaliação", recording:"Gravação", publication:"Publicação"};

function updateLink() {
  const url = new URL(location.href);
  url.search = "";
  for (const [key,value] of [["experiment",versionSelect.value],["replay",replaySelect.value],
    ["view",viewSelect.value],["compare",compareSelect.value]]) {
    if (value) url.searchParams.set(key,value);
  }
  history.replaceState(null,"",url);
  document.getElementById("share").href = url.href;
}

function renderExecution(version) {
  const container = document.getElementById("execution-status");
  container.replaceChildren();
  const run = version?.run;
  const summary = document.getElementById("run-summary");
  if (!run) {
    summary.textContent = "Resultado histórico. Estados, contagens e critério não foram preenchidos retroativamente; consulte a nota original.";
    return;
  }
  for (const [phase,value] of Object.entries(run.stages || {})) {
    if (!phaseLabels[phase]) continue;
    const cell = document.createElement("div");
    cell.className = "stage-status";
    cell.dataset.state = value.state;
    cell.textContent = `${phaseLabels[phase]}: ${stateLabels[value.state] || "Desconhecido"}${value.code ? " · " + value.code : ""}`;
    container.append(cell);
    if (phase === "publication" && /^[a-zA-Z0-9_-]+$/.test(run.id)) {
      fetch("receipts/" + encodeURIComponent(run.id) + ".json", {cache:"no-store",signal:AbortSignal.timeout(15000)})
        .then(response => { if (!response.ok) throw Error("Proof unavailable"); return response.json(); })
        .then(proof => {
          if (versionSelect.value !== run.id) return;
          if (proof.schema !== "terrabot-publication-proof-v1" || proof.id !== run.id || proof.state !== "verified" ||
              !/^[a-f0-9]{64}$/.test(proof.package_sha256 || "") || !/^[a-f0-9]{40}$/.test(proof.result_commit || "")) throw Error("Invalid proof");
          cell.textContent = "Publicação: Verificada · Pages e arquivos públicos conferidos";
          cell.dataset.state = "verified";
        }).catch(() => {
          if (versionSelect.value === run.id) cell.textContent = "Publicação: registro disponível · confirmação final pendente";
        });
    }
  }
  const counts = run.episodes?.evaluation;
  const training = run.episodes?.training;
  summary.textContent = `ID: ${run.id}. Commit: ${run.code?.commit || "desconhecido"}${run.code?.dirty ? " (com alterações locais)" : ""}. Modelo: ${run.model?.sha256 || "indisponível"}. Critério: ${run.goal_criterion}. ` +
    (counts ? `Holdout: ${counts.wins} vitórias e ${counts.losses} tentativas sem vitória em ${counts.completed} episódios completos. ` : "") +
    (training ? `Treino: ${training.wins}/${training.completed} vitórias. ` : "") +
    (counts?.endings ? `Encerramentos holdout: ${counts.endings.death} mortes, ${counts.endings.timeout} limites do mundo, ${counts.endings.decision_limit} limites de decisões e ${counts.endings.other} outros. ` : "") +
    `Configuração: ${JSON.stringify(run.config || {})}. ` +
    "A confirmação final do Pages é registrada no recibo do workflow de publicação.";
}

function renderComparison() {
  const container = document.getElementById("comparison");
  container.replaceChildren();
  const a = manifest.find(v => v.id === versionSelect.value);
  const b = manifest.find(v => v.id === compareSelect.value);
  if (!a || !b) return;
  const table = document.createElement("table");
  const caption = document.createElement("caption");
  const comparable = a.run && b.run && a.run.goal_criterion !== "unverified" &&
    a.run.goal_criterion === b.run.goal_criterion && JSON.stringify(a.run.config) === JSON.stringify(b.run.config);
  caption.textContent = comparable ? "Mesma configuração e critério. Uma comparação isolada não prova evolução." :
    "Comparação descritiva: configurações ou critérios diferentes/desconhecidos. Não interprete como ganho de aprendizado.";
  table.append(caption);
  const row = (values,heading=false) => {
    const tr = document.createElement("tr");
    for (const value of values) {
      const cell = document.createElement(heading ? "th" : "td");
      if (heading) cell.scope = "col";
      cell.textContent = value;
      tr.append(cell);
    }
    table.append(tr);
  };
  row(["Indicador",a.label,b.label],true);
  row(["Critério",a.run?.goal_criterion || "Histórico / não verificado",b.run?.goal_criterion || "Histórico / não verificado"]);
  row(["Vitórias / holdout", ...[a,b].map(v => {
    const c = v.run?.episodes?.evaluation;
    return c ? `${c.wins}/${c.completed}` : "Não informado";
  })]);
  for (const label of new Set([...Object.keys(a.metrics || {}),...Object.keys(b.metrics || {})])) {
    row([label,safePercent(a.metrics?.[label]),safePercent(b.metrics?.[label])]);
  }
  container.append(table);
}

const safePercent = value => Number.isFinite(value)
  ? Math.round(value * 1000) / 10 + "%" : "—";

function releasePreviousReplay() {
  video.removeAttribute("src");
  if (activeBlobUrl !== null) {
    URL.revokeObjectURL(activeBlobUrl);
    activeBlobUrl = null;
  }
}

async function renderReplay() {
  const request = ++loadGeneration;
  releasePreviousReplay();
  const version = manifest.find(item => item.id === versionSelect.value);
  const replay = version?.replays?.find(item => item.file === replaySelect.value);
  const selectedView = replay?.views?.find(item => item.id === viewSelect.value);
  const mediaFile = selectedView?.file || replay?.file;
  video.hidden = true;
  empty.hidden = false;
  updateLink();

  if (!replay) {
    title.textContent = "Execução registrada sem gravação";
    description.textContent = "";
    status.textContent = "";
    empty.textContent = "Não há GIF disponível para esta execução. Consulte os estados do treinamento, avaliação e gravação abaixo.";
    return;
  }
  title.textContent = replay.label;
  description.textContent = replay.description || "";
  status.textContent = "Carregando replay…";
  empty.textContent = "Carregando gravação…";

  // The manifest is maintained by the publisher, but still validate every path.
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(mediaFile || "")) {
    status.textContent = "Arquivo inválido";
    empty.textContent = "Nome de arquivo de replay inválido.";
    return;
  }

  video.onload = () => {
    if (request !== loadGeneration) return;
    video.hidden = false;
    empty.hidden = true;
    status.textContent = selectedView ? selectedView.label : "Replay animado";
  };
  video.onerror = () => {
    if (request !== loadGeneration) return;
    video.hidden = true;
    empty.hidden = false;
    empty.textContent = "A gravação não pôde ser carregada.";
    status.textContent = "Gravação indisponível";
  };

  try {
    const url = "media/" + encodeURIComponent(mediaFile);
    if (replay.encoding === "base64-gif") {
      // GitHub text-only uploads are used to deliver safe, approved GIF bytes
      // without exposing model checkpoints or requiring a private account.
      if (!mediaFile.endsWith(".gif.b64")) throw Error("Expected GIF base64 file");
      // Large, approved GIFs can be split into base64 chunks to stay within
      // the GitHub text-file upload limit. Chunks are rejoined before decode.
      const mediaParts = Array.isArray(selectedView?.parts) ? selectedView.parts : [mediaFile];
      if (mediaParts.length < 1 || mediaParts.length > 4 ||
          !mediaParts.every(part => /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(part))) {
        throw Error("Invalid replay chunk manifest");
      }
      const responses = await Promise.all(mediaParts.map(part =>
        fetch("media/" + encodeURIComponent(part), {cache: "no-store"})));
      if (responses.some(response => !response.ok)) throw Error("GIF base64 missing");
      const encoded = (await Promise.all(responses.map(response => response.text())))
        .join("").replace(/\s+/g, "");
      if (!encoded || encoded.length > 5000000 ||
          !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
        throw Error("Invalid GIF base64");
      }
      const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
      const header = String.fromCharCode(...bytes.slice(0, 6));
      if (header !== "GIF89a" && header !== "GIF87a") throw Error("Not a GIF");
      if (request !== loadGeneration) return;
      activeBlobUrl = URL.createObjectURL(new Blob([bytes], {type: "image/gif"}));
      video.src = activeBlobUrl;
    } else if (!replay.encoding && mediaFile.endsWith(".gif")) {
      video.src = url; // Existing PixelWorld animations remain unchanged.
    } else {
      throw Error("Unsupported replay encoding");
    }
  } catch (_) {
    if (request !== loadGeneration) return;
    video.hidden = true;
    empty.hidden = false;
    empty.textContent = "A gravação ainda não está disponível.";
    status.textContent = "Gravação indisponível";
  }
}

function renderViews() {
  const version = manifest.find(item => item.id === versionSelect.value);
  const replay = version?.replays?.find(item => item.file === replaySelect.value);
  const views = Array.isArray(replay?.views) ? replay.views : [];
  viewSelect.replaceChildren();
  viewSwitch.hidden = views.length < 2;
  for (const view of views) {
    if (typeof view.id !== "string" || typeof view.file !== "string") continue;
    const option = document.createElement("option");
    option.value = view.id;
    option.textContent = view.label || view.id;
    viewSelect.append(option);
  }
  if (views.some(view => view.id === "game")) viewSelect.value = "game";
}

function renderVersion(replayId=null, viewId=null) {
  const version = manifest.find(item => item.id === versionSelect.value);
  replaySelect.replaceChildren();
  for (const replay of version?.replays || []) {
    const option = document.createElement("option");
    option.value = replay.file;
    option.textContent = replay.label;
    replaySelect.append(option);
  }
  metrics.replaceChildren();
  for (const [label, value] of Object.entries(version?.metrics || {})) {
    const cell = document.createElement("div");
    cell.className = "metric";
    const big = document.createElement("b");
    big.textContent = safePercent(value);
    const small = document.createElement("span");
    small.textContent = label;
    cell.append(big, small);
    metrics.append(cell);
  }
  evaluationNote.textContent = version?.evaluation_note ||
    "Taxas calculadas por avaliação independente; os GIFs são exemplos individuais.";
  renderViews();
  if (replayId && [...replaySelect.options].some(option => option.value === replayId)) {
    replaySelect.value = replayId;
    renderViews();
  }
  if (viewId && [...viewSelect.options].some(option => option.value === viewId)) viewSelect.value = viewId;
  renderExecution(version);
  renderComparison();
  renderReplay();
}

async function loadCatalog() {
  const generation = ++catalogGeneration;
  const previous = new URL(location.href).searchParams;
  catalogStatus.textContent = "Atualizando catálogo…";
  try {
    const response = await fetch("manifest.json?refresh=" + Date.now(), {cache: "no-store", signal: AbortSignal.timeout(15000)});
    if (!response.ok) throw Error("Manifest unavailable");
    const incoming = await response.json();
    if (!Array.isArray(incoming) || incoming.some(v => !v || typeof v.id !== "string" || typeof v.label !== "string" || !Array.isArray(v.replays))) throw Error("Invalid manifest");
    if (new Set(incoming.map(v => v.id)).size !== incoming.length) throw Error("Duplicate experiment IDs");
    if (generation !== catalogGeneration) return;
    manifest = incoming;
    versionSelect.replaceChildren();
    compareSelect.replaceChildren(new Option("Sem comparação",""));
    for (const version of manifest) {
      const option = document.createElement("option");
      option.value = version.id;
      const stages = Object.values(version.run?.stages || {});
      const problem = stages.find(stage => stage.state === "failed") || stages.find(stage => stage.state === "interrupted");
      const state = problem?.state || version.run?.stages?.training?.state;
      const label = state === "failed" ? "Falha em etapa" : stateLabels[state] || state;
      option.textContent = version.label + (state ? ` · ${label}` : " · Histórico");
      versionSelect.append(option);
      compareSelect.append(new Option(version.label,version.id));
    }
    if (manifest.some(v => v.id === previous.get("experiment"))) versionSelect.value = previous.get("experiment");
    if (manifest.some(v => v.id === previous.get("compare"))) compareSelect.value = previous.get("compare");
    catalogStatus.textContent = `${manifest.length} execuções no catálogo. Atualizado às ${new Date().toLocaleTimeString("pt-BR")}.`;
    if (previous.get("experiment") && !manifest.some(v => v.id === previous.get("experiment"))) {
      catalogStatus.textContent += " O link solicitado não está no catálogo; exibindo uma execução disponível.";
    }
    renderVersion(previous.get("replay"),previous.get("view"));
  } catch (_) {
    if (generation !== catalogGeneration) return;
    catalogStatus.textContent = "Não foi possível atualizar o catálogo. Confira sua conexão e toque em Atualizar catálogo para tentar novamente.";
    if (!manifest.length) {
      empty.hidden = false;
      video.hidden = true;
      empty.textContent = "Catálogo indisponível. Use Atualizar catálogo para tentar novamente.";
      status.textContent = "Falha de conexão";
    }
  }
}

versionSelect.addEventListener("change", () => renderVersion());
replaySelect.addEventListener("change", () => { renderViews(); renderReplay(); });
viewSelect.addEventListener("change", renderReplay);
compareSelect.addEventListener("change", () => { renderComparison(); updateLink(); });
document.getElementById("refresh").addEventListener("click", loadCatalog);
loadCatalog();
