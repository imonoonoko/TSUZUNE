const terrainNodes = [
  { id: 'question', label: '問い', kind: '起点', summary: 'ふと残した疑問が、あとから考え直すための起点になる。', relatedIds: ['observation', 'source'] },
  { id: 'observation', label: '記録', kind: '観察', summary: 'その日に見たこと、感じたことを、加工せずに置いておく。', relatedIds: ['question', 'discovery'] },
  { id: 'discovery', label: '発見', kind: '接続', summary: '別のノートとの関係が見え、問いに新しい角度が生まれる。', relatedIds: ['observation', 'return'] },
  { id: 'source', label: '出典', kind: '根拠', summary: 'なぜそう考えたのかを、元の資料と一緒にたどれる。', relatedIds: ['question', 'return'] },
  { id: 'return', label: '再訪', kind: '循環', summary: '時間を置いて、過去の自分の考えにもう一度戻ってくる。', relatedIds: ['discovery', 'source'] },
];

const nodeById = new Map(terrainNodes.map((node) => [node.id, node]));
let selectedNodeId = 'question';
const nodeButtons = [...document.querySelectorAll('[data-node-id]')];
const linkButtons = document.querySelector('#terrain-links');
const inspectorKind = document.querySelector('#inspector-kind');
const inspectorTitle = document.querySelector('#inspector-title');
const inspectorSummary = document.querySelector('#inspector-summary');
const threadLines = [...document.querySelectorAll('[data-link]')];

function renderTerrain() {
  const selected = nodeById.get(selectedNodeId);
  nodeButtons.forEach((button) => {
    const isSelected = button.dataset.nodeId === selected.id;
    button.classList.toggle('is-selected', isSelected);
    button.setAttribute('aria-label', `${nodeById.get(button.dataset.nodeId).label}を選択${isSelected ? '（選択中）' : ''}`);
  });
  threadLines.forEach((line) => {
    const [from, to] = line.dataset.link.split('-');
    line.classList.toggle('is-active', from === selected.id || to === selected.id);
  });

  inspectorKind.textContent = selected.kind;
  inspectorTitle.textContent = selected.label;
  inspectorSummary.textContent = selected.summary;
  linkButtons.replaceChildren(...selected.relatedIds.map((relatedId) => {
    const related = nodeById.get(relatedId);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'inspector-link';
    button.textContent = related.label;
    button.addEventListener('click', () => selectNode(related.id, true));
    return button;
  }));
}

function selectNode(nodeId, shouldFocus = false) {
  selectedNodeId = nodeId;
  renderTerrain();
  if (shouldFocus) document.querySelector(`[data-node-id="${nodeId}"]`).focus();
}

nodeButtons.forEach((button) => button.addEventListener('click', () => selectNode(button.dataset.nodeId)));
document.documentElement.classList.add('terrain-live');
renderTerrain();
