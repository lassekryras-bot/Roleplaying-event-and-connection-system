const laneLabel = {
  past: 'Past',
  now: 'Now',
  future_possible: 'Future Possible'
};

const laneBuckets = {
  past: document.querySelector('[data-lane-cards="past"]'),
  now: document.querySelector('[data-lane-cards="now"]'),
  future_possible: document.querySelector('[data-lane-cards="future_possible"]')
};

const panel = document.getElementById('event-side-panel');
const panelTitle = document.getElementById('panel-title');
const panelLane = document.getElementById('panel-lane');
const panelTime = document.getElementById('panel-time');
const panelDescription = document.getElementById('panel-description');
const closePanel = document.getElementById('close-panel');
const cardTemplate = document.getElementById('event-card-template');

closePanel.addEventListener('click', () => closeEventPanel());

document.querySelectorAll('[data-lane-jump]').forEach((button) => {
  button.addEventListener('click', () => {
    const laneId = `lane-${button.dataset.laneJump}`;
    document.getElementById(laneId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

function openEventPanel(event) {
  panelTitle.textContent = event.title;
  panelLane.textContent = laneLabel[event.lane] || event.lane;
  panelTime.textContent = event.timestamp || 'Unknown';
  panelDescription.textContent = event.description || 'No details available.';
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
}

function closeEventPanel() {
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
}

function renderEvent(event) {
  const fragment = cardTemplate.content.cloneNode(true);
  const card = fragment.querySelector('.event-card');
  fragment.querySelector('.event-title').textContent = event.title;
  fragment.querySelector('.event-time').textContent = event.timestamp || 'Unknown';
  fragment.querySelector('.event-hover-detail').textContent = event.hoverDetail || event.description || 'No extra details';

  card.addEventListener('click', () => openEventPanel(event));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openEventPanel(event);
    }
  });

  const laneNode = laneBuckets[event.lane];
  if (laneNode) {
    laneNode.appendChild(fragment);
  }
}

async function loadEvents() {
  try {
    const response = await fetch('/timeline/events');
    if (!response.ok) {
      throw new Error(`Failed to fetch timeline events (${response.status})`);
    }

    const payload = await response.json();
    const events = Array.isArray(payload) ? payload : payload.events;

    if (!Array.isArray(events)) {
      throw new Error('Unexpected timeline payload shape');
    }

    // Preserve backend ordering while visually grouping by lane.
    events.forEach(renderEvent);
  } catch (error) {
    const fallbackEvents = [
      { title: 'Initial Encounter', lane: 'past', timestamp: '2026-03-20', description: 'Two factions crossed paths for the first time.' },
      { title: 'Council Meeting', lane: 'now', timestamp: '2026-04-03', description: 'Negotiations are active at the city hall.' },
      { title: 'Alliance Decision', lane: 'future_possible', timestamp: '2026-04-12', description: 'Potential vote on strategic alliance.' }
    ];

    fallbackEvents.forEach(renderEvent);
    console.warn(error);
  }
}

loadEvents();
