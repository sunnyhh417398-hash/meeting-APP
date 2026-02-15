(function () {
  'use strict';

  // ===== State =====
  const state = {
    meetingActive: false,
    meetingStartTime: null,
    meetingElapsed: 0,
    participants: [],
    nextId: 1,
    currentSpeaker: null,
  };

  let meetingTimerInterval = null;
  let speakingInterval = null;
  let chart = null;
  let detailChart = null;

  // ===== Avatar Colors =====
  const AVATAR_COLORS = [
    '#4f46e5', '#7c3aed', '#db2777', '#ea580c',
    '#0891b2', '#059669', '#ca8a04', '#dc2626',
    '#2563eb', '#9333ea', '#c026d3', '#16a34a',
  ];

  // ===== DOM Elements =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    meetingTitle: $('#meeting-title'),
    meetingTimer: $('#meeting-timer'),
    btnStart: $('#btn-start-meeting'),
    btnEnd: $('#btn-end-meeting'),
    participantName: $('#participant-name'),
    btnAdd: $('#btn-add-participant'),
    participantsList: $('#participants-list'),
    chartSection: $('#chart-section'),
    chartCanvas: $('#speaking-chart'),
    statsSummary: $('#stats-summary'),
    historyList: $('#history-list'),
    btnClearHistory: $('#btn-clear-history'),
    historyDetail: $('#history-detail'),
    modalClose: $('#modal-close'),
    detailTitle: $('#detail-title'),
    detailDate: $('#detail-date'),
    detailDuration: $('#detail-duration'),
    detailChart: $('#detail-chart'),
    detailParticipants: $('#detail-participants'),
  };

  // ===== Utility Functions =====
  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getInitials(name) {
    return name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  function getColor(index) {
    return AVATAR_COLORS[index % AVATAR_COLORS.length];
  }

  // ===== Tab Navigation =====
  $$('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.nav-tab').forEach((t) => t.classList.remove('active'));
      $$('.tab-content').forEach((c) => c.classList.remove('active'));
      tab.classList.add('active');
      $(`#tab-${tab.dataset.tab}`).classList.add('active');

      if (tab.dataset.tab === 'history') {
        renderHistory();
      }
    });
  });

  // ===== Meeting Controls =====
  els.btnStart.addEventListener('click', startMeeting);
  els.btnEnd.addEventListener('click', endMeeting);

  function startMeeting() {
    state.meetingActive = true;
    state.meetingStartTime = Date.now();
    state.meetingElapsed = 0;

    els.btnStart.disabled = true;
    els.btnEnd.disabled = false;
    els.meetingTitle.disabled = false;

    meetingTimerInterval = setInterval(updateMeetingTimer, 1000);
    speakingInterval = setInterval(updateSpeakingTimes, 200);

    renderParticipants();
  }

  function endMeeting() {
    // Stop any active speaker
    if (state.currentSpeaker !== null) {
      stopSpeaking(state.currentSpeaker);
    }

    state.meetingActive = false;
    clearInterval(meetingTimerInterval);
    clearInterval(speakingInterval);

    els.btnStart.disabled = false;
    els.btnEnd.disabled = true;

    // Save to history
    saveMeetingToHistory();

    renderParticipants();
    updateChart();
  }

  function updateMeetingTimer() {
    state.meetingElapsed = (Date.now() - state.meetingStartTime) / 1000;
    els.meetingTimer.textContent = formatTime(state.meetingElapsed);
  }

  // ===== Participant Management =====
  els.btnAdd.addEventListener('click', addParticipant);
  els.participantName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addParticipant();
  });

  function addParticipant() {
    const name = els.participantName.value.trim();
    if (!name) return;

    state.participants.push({
      id: state.nextId++,
      name,
      speakingTime: 0,
      isSpeaking: false,
      speakingStart: null,
      colorIndex: state.participants.length,
    });

    els.participantName.value = '';
    els.participantName.focus();

    renderParticipants();
    updateChart();
  }

  function removeParticipant(id) {
    if (state.currentSpeaker === id) {
      stopSpeaking(id);
    }
    state.participants = state.participants.filter((p) => p.id !== id);
    renderParticipants();
    updateChart();
  }

  function toggleSpeaking(id) {
    if (!state.meetingActive) return;

    const participant = state.participants.find((p) => p.id === id);
    if (!participant) return;

    if (participant.isSpeaking) {
      stopSpeaking(id);
    } else {
      // Stop current speaker first (only one speaks at a time)
      if (state.currentSpeaker !== null) {
        stopSpeaking(state.currentSpeaker);
      }
      startSpeaking(id);
    }

    renderParticipants();
  }

  function startSpeaking(id) {
    const participant = state.participants.find((p) => p.id === id);
    if (!participant) return;

    participant.isSpeaking = true;
    participant.speakingStart = Date.now();
    state.currentSpeaker = id;
  }

  function stopSpeaking(id) {
    const participant = state.participants.find((p) => p.id === id);
    if (!participant) return;

    if (participant.isSpeaking && participant.speakingStart) {
      participant.speakingTime += (Date.now() - participant.speakingStart) / 1000;
      participant.speakingStart = null;
    }
    participant.isSpeaking = false;

    if (state.currentSpeaker === id) {
      state.currentSpeaker = null;
    }
  }

  function getLiveSpeakingTime(participant) {
    let time = participant.speakingTime;
    if (participant.isSpeaking && participant.speakingStart) {
      time += (Date.now() - participant.speakingStart) / 1000;
    }
    return time;
  }

  function updateSpeakingTimes() {
    const totalSpeaking = state.participants.reduce(
      (sum, p) => sum + getLiveSpeakingTime(p),
      0
    );

    state.participants.forEach((p) => {
      const timeEl = document.querySelector(`[data-time-id="${p.id}"]`);
      const barEl = document.querySelector(`[data-bar-id="${p.id}"]`);
      const pctEl = document.querySelector(`[data-pct-id="${p.id}"]`);

      if (timeEl) {
        const t = getLiveSpeakingTime(p);
        timeEl.textContent = formatTime(t);
      }
      if (barEl && pctEl) {
        const pct = totalSpeaking > 0 ? (getLiveSpeakingTime(p) / totalSpeaking) * 100 : 0;
        barEl.style.width = `${pct}%`;
        pctEl.textContent = `${Math.round(pct)}%`;
      }
    });

    updateChart();
    updateStats();
  }

  // ===== Render Participants =====
  function renderParticipants() {
    if (state.participants.length === 0) {
      els.participantsList.innerHTML =
        '<p class="empty-state">No participants yet. Add someone to get started.</p>';
      els.chartSection.style.display = 'none';
      return;
    }

    els.chartSection.style.display = '';

    const totalSpeaking = state.participants.reduce(
      (sum, p) => sum + getLiveSpeakingTime(p),
      0
    );

    els.participantsList.innerHTML = state.participants
      .map((p) => {
        const time = getLiveSpeakingTime(p);
        const pct = totalSpeaking > 0 ? (time / totalSpeaking) * 100 : 0;
        const color = getColor(p.colorIndex);
        const isSpeaking = p.isSpeaking;

        return `
        <div class="participant-card ${isSpeaking ? 'is-speaking' : ''}">
          <div class="participant-avatar" style="background:${color}">
            ${getInitials(p.name)}
          </div>
          <div class="participant-info">
            <div class="participant-name">${escapeHtml(p.name)}</div>
            <div class="participant-time" data-time-id="${p.id}">${formatTime(time)}</div>
          </div>
          <div class="participant-bar-container">
            <div class="participant-bar" data-bar-id="${p.id}" style="width:${pct}%;background:${color}"></div>
          </div>
          <div class="participant-pct" data-pct-id="${p.id}">${Math.round(pct)}%</div>
          <div class="participant-actions">
            <button class="btn btn-speak btn-small ${isSpeaking ? 'speaking' : ''}"
              onclick="window.__toggleSpeaking(${p.id})"
              ${!state.meetingActive ? 'disabled' : ''}>
              ${isSpeaking ? 'Stop' : 'Speak'}
            </button>
            <button class="btn-remove" onclick="window.__removeParticipant(${p.id})" title="Remove">
              &times;
            </button>
          </div>
        </div>`;
      })
      .join('');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Expose to onclick handlers
  window.__toggleSpeaking = toggleSpeaking;
  window.__removeParticipant = removeParticipant;

  // ===== Chart =====
  function updateChart() {
    if (state.participants.length === 0) return;

    const labels = state.participants.map((p) => p.name);
    const data = state.participants.map((p) => Math.round(getLiveSpeakingTime(p)));
    const colors = state.participants.map((p) => getColor(p.colorIndex));

    if (!chart) {
      chart = new Chart(els.chartCanvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const val = ctx.raw;
                  const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                  return `${ctx.label}: ${formatTime(val)} (${pct}%)`;
                },
              },
            },
          },
          cutout: '60%',
        },
      });
    } else {
      chart.data.labels = labels;
      chart.data.datasets[0].data = data;
      chart.data.datasets[0].backgroundColor = colors;
      chart.update('none');
    }
  }

  function updateStats() {
    if (state.participants.length === 0) return;

    const totalSpeaking = state.participants.reduce(
      (sum, p) => sum + getLiveSpeakingTime(p),
      0
    );
    const silentTime = Math.max(0, state.meetingElapsed - totalSpeaking);
    const mostActive = [...state.participants].sort(
      (a, b) => getLiveSpeakingTime(b) - getLiveSpeakingTime(a)
    )[0];

    els.statsSummary.innerHTML = `
      <div class="stat-item"><strong>${formatTime(state.meetingElapsed)}</strong>Meeting Duration</div>
      <div class="stat-item"><strong>${formatTime(totalSpeaking)}</strong>Total Speaking</div>
      <div class="stat-item"><strong>${formatTime(silentTime)}</strong>Silent Time</div>
      <div class="stat-item"><strong>${escapeHtml(mostActive.name)}</strong>Most Active</div>
    `;
  }

  // ===== Meeting History (localStorage) =====
  const STORAGE_KEY = 'meeting_tracker_history';

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveHistory(history) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }

  function saveMeetingToHistory() {
    if (state.participants.length === 0) return;

    const totalSpeaking = state.participants.reduce(
      (sum, p) => sum + getLiveSpeakingTime(p),
      0
    );

    const meeting = {
      id: Date.now(),
      title: els.meetingTitle.value.trim() || 'Untitled Meeting',
      date: state.meetingStartTime,
      duration: state.meetingElapsed,
      participants: state.participants.map((p) => ({
        name: p.name,
        speakingTime: getLiveSpeakingTime(p),
        percentage:
          totalSpeaking > 0
            ? Math.round((getLiveSpeakingTime(p) / totalSpeaking) * 100)
            : 0,
        colorIndex: p.colorIndex,
      })),
    };

    const history = getHistory();
    history.unshift(meeting);
    saveHistory(history);
  }

  function renderHistory() {
    const history = getHistory();

    if (history.length === 0) {
      els.historyList.innerHTML =
        '<p class="empty-state">No meeting history yet.</p>';
      return;
    }

    els.historyList.innerHTML = history
      .map(
        (m) => `
      <div class="history-card" onclick="window.__showDetail(${m.id})">
        <div class="history-card-info">
          <h3>${escapeHtml(m.title)}</h3>
          <p>${formatDate(m.date)} &bull; ${m.participants.length} participants</p>
        </div>
        <div class="history-card-meta">
          <strong>${formatTime(m.duration)}</strong>
          duration
        </div>
      </div>`
      )
      .join('');
  }

  els.btnClearHistory.addEventListener('click', () => {
    if (confirm('Delete all meeting history?')) {
      saveHistory([]);
      renderHistory();
    }
  });

  // ===== History Detail Modal =====
  window.__showDetail = function (meetingId) {
    const history = getHistory();
    const meeting = history.find((m) => m.id === meetingId);
    if (!meeting) return;

    els.detailTitle.textContent = meeting.title;
    els.detailDate.textContent = formatDate(meeting.date);
    els.detailDuration.textContent = `Duration: ${formatTime(meeting.duration)}`;

    // Chart
    if (detailChart) detailChart.destroy();

    const labels = meeting.participants.map((p) => p.name);
    const data = meeting.participants.map((p) => Math.round(p.speakingTime));
    const colors = meeting.participants.map((p) => getColor(p.colorIndex));

    detailChart = new Chart(els.detailChart, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.raw;
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                return `${ctx.label}: ${formatTime(val)} (${pct}%)`;
              },
            },
          },
        },
        cutout: '60%',
      },
    });

    // Participants table
    const sorted = [...meeting.participants].sort(
      (a, b) => b.speakingTime - a.speakingTime
    );

    els.detailParticipants.innerHTML = sorted
      .map(
        (p) => `
      <div class="detail-participant-row">
        <span class="name">${escapeHtml(p.name)}</span>
        <span class="time">${formatTime(p.speakingTime)}</span>
        <span class="pct">${p.percentage}%</span>
      </div>`
      )
      .join('');

    els.historyDetail.style.display = '';
  };

  els.modalClose.addEventListener('click', () => {
    els.historyDetail.style.display = 'none';
  });

  els.historyDetail.addEventListener('click', (e) => {
    if (e.target === els.historyDetail) {
      els.historyDetail.style.display = 'none';
    }
  });

  // ===== Init =====
  renderHistory();
})();
