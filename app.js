"use strict";
const versionSelect = document.getElementById("version");
const replaySelect = document.getElementById("replay");
const video = document.getElementById("video");
const empty = document.getElementById("empty");
const title = document.getElementById("title");
const status = document.getElementById("status");
const description = document.getElementById("description");
const metrics = document.getElementById("metrics");
const evaluationNote = document.getElementById("evaluation-note");
let manifest = [];
let activeBlobUrl = null;
let loadGeneration = 0;

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
  video.hidden = true;
  empty.hidden = false;

  if (!replay) {
    title.textContent = "Nenhuma gravação";
    description.textContent = "";
    status.textContent = "";
    empty.textContent = "Esta gravação ainda não foi publicada.";
    return;
  }
  title.textContent = replay.label;
  description.textContent = replay.description || "";
  status.textContent = "Carregando replay…";
  empty.textContent = "Carregando gravação…";

  // The manifest is maintained by the publisher, but still validate every path.
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(replay.file)) {
    status.textContent = "Arquivo inválido";
    empty.textContent = "Nome de arquivo de replay inválido.";
    return;
  }

  video.onload = () => {
    if (request !== loadGeneration) return;
    video.hidden = false;
    empty.hidden = true;
    status.textContent = "Replay animado";
  };
  video.onerror = () => {
    if (request !== loadGeneration) return;
    video.hidden = true;
    empty.hidden = false;
    empty.textContent = "A gravação não pôde ser carregada.";
    status.textContent = "Gravação indisponível";
  };

  try {
    const url = "media/" + encodeURIComponent(replay.file);
    if (replay.encoding === "base64-gif") {
      // GitHub text-only uploads are used to deliver safe, approved GIF bytes
      // without exposing model checkpoints or requiring a private account.
      if (!replay.file.endsWith(".gif.b64")) throw Error("Expected GIF base64 file");
      const response = await fetch(url, {cache: "no-store"});
      if (!response.ok) throw Error("GIF base64 missing");
      const encoded = (await response.text()).replace(/\s+/g, "");
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
    } else if (!replay.encoding && replay.file.endsWith(".gif")) {
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

function renderVersion() {
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
  renderReplay();
}

async function init() {
  try {
    const response = await fetch("manifest.json", {cache: "no-store"});
    if (!response.ok) throw Error("Manifest unavailable");
    manifest = await response.json();
    if (!Array.isArray(manifest)) throw Error("Invalid manifest");
    for (const version of manifest) {
      const option = document.createElement("option");
      option.value = version.id;
      option.textContent = version.label;
      versionSelect.append(option);
    }
    versionSelect.addEventListener("change", renderVersion);
    replaySelect.addEventListener("change", renderReplay);
    renderVersion();
  } catch (_) {
    empty.hidden = false;
    video.hidden = true;
    empty.textContent = "Não foi possível carregar os replays.";
    status.textContent = "Erro";
  }
}

init();
