const countEl = document.getElementById('count');
const statusEl = document.getElementById('status');
const refreshBtn = document.getElementById('refresh-btn');

async function fetchHits() {
  refreshBtn.disabled = true;
  statusEl.textContent = 'Connecting…';
  statusEl.classList.remove('error');

  try {
    const res = await fetch('/api/hits');
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const data = await res.json();

    countEl.textContent = data.hits;
    countEl.classList.add('bump');
    setTimeout(() => countEl.classList.remove('bump'), 150);

    statusEl.textContent = 'Connected to Redis ✓';
  } catch (err) {
    statusEl.textContent = `Could not reach the server (${err.message})`;
    statusEl.classList.add('error');
  } finally {
    refreshBtn.disabled = false;
  }
}

refreshBtn.addEventListener('click', fetchHits);

// Count a hit as soon as the page loads
fetchHits();
