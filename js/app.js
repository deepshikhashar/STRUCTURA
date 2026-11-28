(function () {
  'use strict';

  const Data = window.StructuraData;

  const VIEW_META = {
    dashboard: {
      title: 'Project Operations Dashboard',
      subtitle: 'Real-time site progress, workforce allocation, and automated delay tracking'
    },
    projects: {
      title: 'Projects & Sequential Work Phases',
      subtitle: 'Create construction projects, manage staged work pipelines, and track milestones'
    },
    tasks: {
      title: 'Task Assignment & Deadlines',
      subtitle: 'Assign work packages to field crews, monitor deadlines, and update task status'
    },
    delays: {
      title: 'Automated Delay Radar',
      subtitle: 'Live schedule watchdog flagging overdue tasks, slipped phases, and late materials'
    },
    workers: {
      title: 'Workers & Crew Records',
      subtitle: 'Manage site teams, trade certifications, deployment status, and workload'
    },
    materials: {
      title: 'Material Requirements & BOM',
      subtitle: 'Track site material requisitions, supplier deliveries, consumption, and shortages'
    }
  };

  let state = Data.loadState();

  const ui = {
    activeView: 'dashboard',
    searchQuery: '',
    projectFilter: 'ALL',
    taskStatusFilter: 'ALL',
    taskProjectFilter: 'ALL',
    taskViewMode: 'kanban',
    delayRadarFilter: 'ALL',
    delayViewMode: 'cards',
    workerFilter: 'ALL',
    workerSpecialtyFilter: 'ALL',
    materialFilter: 'ALL',
    materialProjectFilter: 'ALL',
    materialViewMode: 'cards',
    spotlightProjectId: null,
    delayTriageFilter: 'ALL',
    selectedPhaseByProject: {},
    inspectedProjectId: null
  };

  const TRADE_COLORS = {
    'Concrete & Formwork': '#d95d24',
    'Structural Steel': '#2563eb',
    'MEP Systems': '#0d9488',
    'Post-Tension & Civil': '#7c3aed',
    'Heavy Rigging & Crane': '#d97706',
    'Interior Finishing': '#15803d',
    'Facade & Glazing': '#0284c7',
    'Site QA & Safety': '#dc2626'
  };

  function getTradeColor(trade) {
    return TRADE_COLORS[trade] || '#475569';
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseUtcDate(yyyyMmDd) {
    if (!yyyyMmDd) return null;
    const parts = yyyyMmDd.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    return Date.UTC(parts[0], parts[1] - 1, parts[2]);
  }

  function diffDays(laterDateStr, earlierDateStr) {
    const t1 = parseUtcDate(laterDateStr);
    const t2 = parseUtcDate(earlierDateStr);
    if (t1 === null || t2 === null) return 0;
    return Math.round((t1 - t2) / 86400000);
  }

  function formatShortDate(yyyyMmDd) {
    const utc = parseUtcDate(yyyyMmDd);
    if (utc === null) return '—';
    return new Date(utc).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    });
  }

  function formatCompactCurrency(amount) {
    const val = Number(amount) || 0;
    if (val >= 1000000) {
      return `$${(val / 1000000).toFixed(2)}M`;
    }
    if (val >= 1000) {
      return `$${(val / 1000).toFixed(0)}k`;
    }
    return `$${val.toLocaleString('en-US')}`;
  }

  function getInitials(name) {
    if (!name) return 'CR';
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 3400);
  }

  function isTaskDelayed(task, refDate) {
    if (!task || task.status === 'Completed' || !task.deadline) {
      return { delayed: false, daysOverdue: 0, severity: null };
    }
    const days = diffDays(refDate, task.deadline);
    if (days > 0) {
      return {
        delayed: true,
        daysOverdue: days,
        severity: days >= 5 ? 'Critical' : 'Overdue'
      };
    }
    return { delayed: false, daysOverdue: 0, severity: null };
  }

  function isMaterialDelayed(mat, refDate) {
    if (!mat) return { delayed: false, daysOverdue: 0, shortageQty: 0 };
    const req = Number(mat.requiredQty) || 0;
    const del = Number(mat.deliveredQty) || 0;
    const shortageQty = Math.max(0, req - del);
    if (shortageQty > 0 && mat.deliveryDeadline) {
      const days = diffDays(refDate, mat.deliveryDeadline);
      if (days > 0) {
        return { delayed: true, daysOverdue: days, shortageQty };
      }
    }
    return { delayed: false, daysOverdue: 0, shortageQty };
  }

  function computeTaskBasedProgress(phaseTasks) {
    if (!phaseTasks.length) return null;
    const total = phaseTasks.reduce((sum, task) => {
      if (task.status === 'Completed') return sum + 100;
      if (task.status === 'In Progress') return sum + 45;
      return sum;
    }, 0);
    return Math.round(total / phaseTasks.length);
  }

  function getPhaseComputedState(phase, projectTasks, refDate) {
    const phaseTasks = projectTasks.filter((t) => t.phaseId === phase.id);
    let progress = Number(phase.progress) || 0;
    if (!phase.manualProgress && phaseTasks.length > 0) {
      progress = computeTaskBasedProgress(phaseTasks);
    }
    progress = Math.max(0, Math.min(100, progress));

    let delayedTasksCount = 0;
    let maxTaskOverdue = 0;
    phaseTasks.forEach((t) => {
      const check = isTaskDelayed(t, refDate);
      if (check.delayed) {
        delayedTasksCount += 1;
        if (check.daysOverdue > maxTaskOverdue) maxTaskOverdue = check.daysOverdue;
      }
    });

    const phaseDeadlineDays = phase.deadline ? diffDays(refDate, phase.deadline) : 0;
    const deadlineSlipped = progress < 100 && phaseDeadlineDays > 0;
    const maxOverdueDays = Math.max(deadlineSlipped ? phaseDeadlineDays : 0, maxTaskOverdue);

    let status = 'Pending';
    if (progress >= 100) {
      status = 'Completed';
    } else if (deadlineSlipped || delayedTasksCount > 0) {
      status = 'Delayed';
    } else if (progress > 0 || phaseTasks.some((t) => t.status === 'In Progress')) {
      status = 'Active';
    }

    return {
      phase,
      progress,
      status,
      deadlineSlipped,
      phaseDeadlineDays: deadlineSlipped ? phaseDeadlineDays : 0,
      delayedTasksCount,
      maxOverdueDays,
      tasks: phaseTasks
    };
  }

  function getProjectComputedState(project, refDate) {
    const projectTasks = state.tasks.filter((t) => t.projectId === project.id);
    const projectMaterials = state.materials.filter((m) => m.projectId === project.id);
    const phaseStates = (project.phases || []).map((ph) =>
      getPhaseComputedState(ph, projectTasks, refDate)
    );

    const overallProgress = phaseStates.length
      ? Math.round(phaseStates.reduce((acc, p) => acc + p.progress, 0) / phaseStates.length)
      : 0;

    const delayedPhases = phaseStates.filter((p) => p.status === 'Delayed');
    const delayedTasks = projectTasks.filter((t) => isTaskDelayed(t, refDate).delayed);
    const delayedMaterials = projectMaterials.filter((m) => isMaterialDelayed(m, refDate).delayed);

    let status = 'Active';
    if (phaseStates.length > 0 && phaseStates.every((p) => p.status === 'Completed')) {
      status = 'Completed';
    } else if (
      delayedPhases.length > 0 ||
      delayedTasks.length > 0 ||
      delayedMaterials.length > 0
    ) {
      status = 'Delayed';
    }

    return {
      project,
      phaseStates,
      overallProgress,
      status,
      totalTasks: projectTasks.length,
      completedTasks: projectTasks.filter((t) => t.status === 'Completed').length,
      delayedPhasesCount: delayedPhases.length,
      delayedTasksCount: delayedTasks.length,
      delayedMaterialsCount: delayedMaterials.length
    };
  }

  function recalculatePhaseProgressFromTasks(projectId, phaseId) {
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) return;
    const phase = (project.phases || []).find((ph) => ph.id === phaseId);
    if (!phase) return;
    const phaseTasks = state.tasks.filter((t) => t.projectId === projectId && t.phaseId === phaseId);
    if (phaseTasks.length > 0) {
      phase.manualProgress = false;
      phase.progress = computeTaskBasedProgress(phaseTasks);
    }
  }

  function getPortalAnalytics() {
    const refDate = state.referenceDate;
    const projectReports = state.projects.map((p) => getProjectComputedState(p, refDate));

    const delayedTasks = state.tasks
      .map((t) => ({ task: t, delay: isTaskDelayed(t, refDate) }))
      .filter((item) => item.delay.delayed)
      .sort((a, b) => b.delay.daysOverdue - a.delay.daysOverdue);

    const delayedPhases = [];
    projectReports.forEach((rep) => {
      rep.phaseStates.forEach((ps) => {
        if (ps.status === 'Delayed') {
          delayedPhases.push({ project: rep.project, phaseState: ps });
        }
      });
    });

    const delayedMaterials = state.materials
      .map((m) => ({ material: m, delay: isMaterialDelayed(m, refDate) }))
      .filter((item) => item.delay.delayed)
      .sort((a, b) => b.delay.daysOverdue - a.delay.daysOverdue);

    const totalProjects = projectReports.length;
    const completedProjects = projectReports.filter((r) => r.status === 'Completed').length;
    const delayedProjects = projectReports.filter((r) => r.status === 'Delayed').length;
    const onTrackProjects = projectReports.filter((r) => r.status === 'Active').length;
    const activeProjects = totalProjects - completedProjects;

    const totalHeadcount = state.workers.reduce((sum, w) => sum + (Number(w.headcount) || 0), 0);
    const deployedHeadcount = state.workers
      .filter((w) => w.status === 'On Site' || w.status === 'Assigned')
      .reduce((sum, w) => sum + (Number(w.headcount) || 0), 0);

    return {
      refDate,
      projectReports,
      delayedTasks,
      delayedPhases,
      delayedMaterials,
      totalDelayAlerts: delayedTasks.length + delayedMaterials.length,
      counts: {
        totalProjects,
        activeProjects,
        onTrackProjects,
        completedProjects,
        delayedProjects,
        totalTasks: state.tasks.length,
        completedTasks: state.tasks.filter((t) => t.status === 'Completed').length,
        activeTasks: state.tasks.filter((t) => t.status === 'In Progress').length,
        pendingTasks: state.tasks.filter((t) => t.status === 'Pending').length,
        delayedTasks: delayedTasks.length,
        delayedPhases: delayedPhases.length,
        delayedMaterials: delayedMaterials.length,
        totalHeadcount,
        deployedHeadcount
      }
    };
  }

  function shiftReferenceDate(daysOffset) {
    const baseUtc = parseUtcDate(state.referenceDate || Data.getTodayDateString());
    const nextDate = new Date(baseUtc + daysOffset * 86400000).toISOString().slice(0, 10);
    state.referenceDate = nextDate;
    Data.saveState(state);
    renderAll();
    showToast(`Schedule evaluated at ${formatShortDate(nextDate)}.`, 'info');
  }

  function renderSvgRadialRing(pct, options = {}) {
    const size = options.size || 56;
    const stroke = options.stroke || 6;
    const color = options.color || '#d95d24';
    const track = options.track || 'rgba(255, 255, 255, 0.16)';
    const textColor = options.textColor || '#ffffff';
    const fontSize = options.fontSize || 13;

    const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const offset = c * (1 - clamped / 100);
    const half = size / 2;

    return `
      <div class="svg-ring-wrap" style="width:${size}px; height:${size}px;">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
          <circle cx="${half}" cy="${half}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}" />
          <circle
            cx="${half}"
            cy="${half}"
            r="${r}"
            fill="none"
            stroke="${color}"
            stroke-width="${stroke}"
            stroke-linecap="round"
            stroke-dasharray="${c.toFixed(2)}"
            stroke-dashoffset="${offset.toFixed(2)}"
            transform="rotate(-90 ${half} ${half})"
          />
        </svg>
        <span class="svg-ring-text" style="color:${textColor}; font-size:${fontSize}px;">${clamped}%</span>
      </div>
    `;
  }

  function renderSvgDonutChart(segments, centerVal, centerLbl) {
    const size = 146;
    const stroke = 17;
    const r = 56;
    const half = size / 2;
    const c = 2 * Math.PI * r;
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    const nonZero = segments.filter((s) => s.value > 0);

    let arcsHtml = `<circle cx="${half}" cy="${half}" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="${stroke}" />`;
    if (total > 0) {
      let cumLen = 0;
      arcsHtml += nonZero
        .map((seg) => {
          const segLen = (seg.value / total) * c;
          const gap = nonZero.length > 1 ? 2.5 : 0;
          const drawLen = Math.max(2, segLen - gap);
          const arc = `
            <circle
              cx="${half}"
              cy="${half}"
              r="${r}"
              fill="none"
              stroke="${seg.color}"
              stroke-width="${stroke}"
              stroke-dasharray="${drawLen.toFixed(2)} ${c.toFixed(2)}"
              stroke-dashoffset="${(-cumLen).toFixed(2)}"
              transform="rotate(-90 ${half} ${half})"
            />
          `;
          cumLen += segLen;
          return arc;
        })
        .join('');
    }

    return `
      <div class="donut-wrap">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Task schedule health distribution">
          ${arcsHtml}
        </svg>
        <div class="donut-center">
          <div class="donut-center-val">${escapeHtml(centerVal)}</div>
          <div class="donut-center-lbl">${escapeHtml(centerLbl)}</div>
        </div>
      </div>
    `;
  }

  function renderStatusBadge(status) {
    if (status === 'Completed') {
      return '<span class="badge badge-completed">Completed</span>';
    }
    if (status === 'Delayed') {
      return '<span class="badge badge-delayed">Delayed</span>';
    }
    if (status === 'Active' || status === 'In Progress' || status === 'On Site') {
      return `<span class="badge badge-active">${escapeHtml(status)}</span>`;
    }
    if (status === 'Assigned') {
      return '<span class="badge badge-completed">Assigned</span>';
    }
    return `<span class="badge badge-pending">${escapeHtml(status)}</span>`;
  }

  function renderPriorityBadge(priority) {
    if (priority === 'Critical') return '<span class="badge badge-critical">Critical</span>';
    if (priority === 'High') return '<span class="badge badge-delayed">High</span>';
    if (priority === 'Medium') return '<span class="badge badge-active">Medium</span>';
    return '<span class="badge badge-neutral">Low</span>';
  }

  function updateShellCounters(analytics) {
    document.getElementById('badge-projects-count').textContent = analytics.counts.totalProjects;
    document.getElementById('badge-tasks-count').textContent = analytics.counts.totalTasks;
    const delayBadge = document.getElementById('badge-delay-count');
    delayBadge.textContent = analytics.counts.delayedTasks + analytics.counts.delayedMaterials;
    delayBadge.style.display =
      analytics.counts.delayedTasks + analytics.counts.delayedMaterials > 0 ? 'inline-flex' : 'none';
    document.getElementById('badge-workers-count').textContent = state.workers.length;
    document.getElementById('badge-materials-count').textContent = state.materials.length;

    const refInput = document.getElementById('ref-date-input');
    if (refInput && refInput.value !== state.referenceDate) {
      refInput.value = state.referenceDate;
    }
  }

  function switchView(viewName) {
    if (!VIEW_META[viewName]) return;
    ui.activeView = viewName;

    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    document.querySelectorAll('.view-section').forEach((sec) => {
      sec.classList.toggle('active', sec.id === `view-${viewName}`);
    });

    document.getElementById('page-title').textContent = VIEW_META[viewName].title;
    document.getElementById('page-subtitle').textContent = VIEW_META[viewName].subtitle;

    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-backdrop').classList.remove('open');

    renderCurrentView();
  }

  function renderAll() {
    const analytics = getPortalAnalytics();
    updateShellCounters(analytics);
    populateFilterDropdowns();
    renderCurrentView(analytics);

    if (ui.inspectedProjectId) {
      const stillExists = state.projects.some((p) => p.id === ui.inspectedProjectId);
      if (stillExists && document.getElementById('modal-project-detail').classList.contains('open')) {
        renderProjectDetailModal(ui.inspectedProjectId);
      }
    }
  }

  function renderCurrentView(precomputedAnalytics) {
    const analytics = precomputedAnalytics || getPortalAnalytics();
    if (ui.activeView === 'dashboard') renderDashboard(analytics);
    else if (ui.activeView === 'projects') renderProjectsView(analytics);
    else if (ui.activeView === 'tasks') renderTasksView(analytics);
    else if (ui.activeView === 'delays') renderDelayRadarView(analytics);
    else if (ui.activeView === 'workers') renderWorkersView(analytics);
    else if (ui.activeView === 'materials') renderMaterialsView(analytics);
  }

  function renderDashboard(analytics) {
    const { counts, delayedTasks, delayedMaterials, projectReports, refDate } = analytics;
    const q = ui.searchQuery.trim().toLowerCase();

    const filteredReports = projectReports.filter((rep) => {
      if (!q) return true;
      return (
        rep.project.name.toLowerCase().includes(q) ||
        rep.project.code.toLowerCase().includes(q) ||
        rep.project.location.toLowerCase().includes(q)
      );
    });

    if (!ui.spotlightProjectId || !projectReports.some((r) => r.project.id === ui.spotlightProjectId)) {
      ui.spotlightProjectId = projectReports.length ? projectReports[0].project.id : null;
    }
    const spotReport = projectReports.find((r) => r.project.id === ui.spotlightProjectId) || projectReports[0];

    const heroDeckEl = document.getElementById('dashboard-hero-deck');
    let spotlightHtml = '';
    if (spotReport) {
      const sp = spotReport.project;
      const ringColor =
        spotReport.status === 'Completed'
          ? '#22c55e'
          : spotReport.status === 'Delayed'
          ? '#ef4444'
          : '#f59e0b';

      const switcherHtml = projectReports
        .map(
          (rep) => `
          <button
            type="button"
            class="spotlight-pill ${rep.project.id === sp.id ? 'active' : ''}"
            data-spotlight-proj="${escapeHtml(rep.project.id)}"
          >
            ${escapeHtml(rep.project.code)}
          </button>
        `
        )
        .join('');

      const nodesHtml = spotReport.phaseStates
        .slice(0, 4)
        .map((ps) => {
          const cls =
            ps.status === 'Completed'
              ? 'is-completed'
              : ps.status === 'Delayed'
              ? 'is-delayed'
              : ps.status === 'Active'
              ? 'is-active'
              : '';
          const icon =
            ps.status === 'Completed' ? '&#10003;' : ps.status === 'Delayed' ? '!' : ps.status === 'Active' ? '&#9679;' : '&#9675;';
          const shortName = ps.phase.name.replace(/^\d+\.\s*/, '');
          return `
            <button
              type="button"
              class="spot-node ${cls}"
              data-bump-phase="${escapeHtml(sp.id)}|${escapeHtml(ps.phase.id)}"
              title="Click to advance ${escapeHtml(shortName)} (+25%) or inspect"
            >
              <div class="spot-node-top">
                <span>${icon}</span>
                <span>${ps.progress}%</span>
              </div>
              <div class="spot-node-name">${escapeHtml(shortName)}</div>
            </button>
          `;
        })
        .join('');

      spotlightHtml = `
        <article class="spotlight-card">
          <img class="spotlight-bg" src="${escapeHtml(sp.image)}" alt="${escapeHtml(sp.name)}" />
          <div class="spotlight-scrim"></div>
          <div class="spotlight-inner">
            <div class="spotlight-top">
              <div class="spotlight-switcher" aria-label="Switch spotlight project">
                ${switcherHtml}
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                ${renderStatusBadge(spotReport.status)}
                <button type="button" class="spotlight-pill" data-open-project="${escapeHtml(sp.id)}">Inspect &nearr;</button>
              </div>
            </div>

            <div class="spotlight-mid">
              <div>
                <div class="spotlight-kicker">${escapeHtml(sp.code)} &middot; ${escapeHtml(sp.client)}</div>
                <h2 class="spotlight-title">${escapeHtml(sp.name)}</h2>
                <div class="spotlight-meta">
                  <span>&#9679; ${escapeHtml(sp.location)}</span>
                  <span class="mono">${formatCompactCurrency(sp.budget)}</span>
                  <span class="mono">Target ${escapeHtml(formatShortDate(sp.endDate))}</span>
                </div>
              </div>
              <div class="spotlight-gauge">
                ${renderSvgRadialRing(spotReport.overallProgress, {
                  size: 86,
                  stroke: 8,
                  color: ringColor,
                  track: 'rgba(255,255,255,0.16)',
                  textColor: '#ffffff',
                  fontSize: 18
                })}
              </div>
            </div>

            <div class="spotlight-pipeline">
              <div class="spotlight-pipeline-head">
                <span>Interactive Phase Pipeline (click node to advance +25%)</span>
                <span>${spotReport.completedTasks}/${spotReport.totalTasks} Tasks</span>
              </div>
              <div class="spotlight-nodes">${nodesHtml}</div>
            </div>
          </div>
        </article>
      `;
    }

    let tCompleted = 0;
    let tDelayed = 0;
    let tActiveOnTrack = 0;
    let tPendingOnTrack = 0;
    state.tasks.forEach((t) => {
      if (t.status === 'Completed') tCompleted += 1;
      else if (isTaskDelayed(t, refDate).delayed) tDelayed += 1;
      else if (t.status === 'In Progress') tActiveOnTrack += 1;
      else tPendingOnTrack += 1;
    });
    const totalTasksForDonut = Math.max(1, state.tasks.length);
    const completionPct = Math.round((tCompleted / totalTasksForDonut) * 100);
    const totalAlerts = delayedTasks.length + delayedMaterials.length;

    const donutHtml = renderSvgDonutChart(
      [
        { label: 'Completed', value: tCompleted, color: '#22c55e' },
        { label: 'In Progress', value: tActiveOnTrack, color: '#f59e0b' },
        { label: 'Pending', value: tPendingOnTrack, color: '#64748b' },
        { label: 'Delayed', value: tDelayed, color: '#ef4444' }
      ],
      `${completionPct}%`,
      'Done Rate'
    );

    const radarHtml = `
      <aside class="radar-donut-card">
        <div class="radar-head">
          <div>
            <h2 class="radar-title">Schedule Health Radar</h2>
            <p class="radar-sub">Live task telemetry as of <span class="mono">${escapeHtml(formatShortDate(refDate))}</span></p>
          </div>
          ${
            totalAlerts > 0
              ? `<button type="button" class="badge badge-critical mono" data-goto-view="delays" style="cursor:pointer;">${totalAlerts} ALERTS</button>`
              : `<span class="badge badge-completed mono">ON TRACK</span>`
          }
        </div>

        <div class="radar-body">
          ${donutHtml}
          <div class="radar-legend">
            <button type="button" class="legend-chip" data-legend-task-filter="Completed">
              <span class="legend-chip-left"><span class="legend-dot" style="background:#22c55e;"></span>Completed</span>
              <span class="mono">${tCompleted}</span>
            </button>
            <button type="button" class="legend-chip" data-legend-task-filter="In Progress">
              <span class="legend-chip-left"><span class="legend-dot" style="background:#f59e0b;"></span>In Progress</span>
              <span class="mono">${tActiveOnTrack}</span>
            </button>
            <button type="button" class="legend-chip" data-legend-task-filter="Pending">
              <span class="legend-chip-left"><span class="legend-dot" style="background:#64748b;"></span>Pending</span>
              <span class="mono">${tPendingOnTrack}</span>
            </button>
            <button type="button" class="legend-chip" data-legend-task-filter="Delayed">
              <span class="legend-chip-left"><span class="legend-dot" style="background:#ef4444;"></span>Delayed</span>
              <span class="mono" style="color:${tDelayed > 0 ? '#fca5a5' : '#e2e8f0'};">${tDelayed}</span>
            </button>
          </div>
        </div>

        <div class="radar-scrubber">
          <span class="scrubber-label">Time Scrubber:</span>
          <div class="scrubber-chips">
            <button type="button" class="scrubber-chip" data-shift-days="-7">-7d</button>
            <button type="button" class="scrubber-chip" data-shift-days="0">Today</button>
            <button type="button" class="scrubber-chip" data-shift-days="7">+7d</button>
            <button type="button" class="scrubber-chip" data-shift-days="15">+15d</button>
          </div>
        </div>
      </aside>
    `;

    heroDeckEl.innerHTML = spotlightHtml + radarHtml;

    const activeAvgProgress = counts.activeProjects
      ? Math.round(
          projectReports
            .filter((r) => r.status !== 'Completed')
            .reduce((sum, r) => sum + r.overallProgress, 0) / counts.activeProjects
        )
      : 100;

    const totalProjDenom = Math.max(1, counts.totalProjects);
    const pctDoneProj = Math.round((counts.completedProjects / totalProjDenom) * 100);
    const pctTrackProj = Math.round((counts.onTrackProjects / totalProjDenom) * 100);
    const pctDelayProj = Math.max(0, 100 - pctDoneProj - pctTrackProj);

    document.getElementById('dashboard-kpis').innerHTML = `
      <div class="kpi-card" data-kpi-nav="projects:ALL" title="View all projects">
        <div class="kpi-visual-row">
          <div>
            <span class="kpi-label">Total Portfolio</span>
            <div class="kpi-value mono" style="margin-top:6px;">${counts.totalProjects}</div>
          </div>
          <span class="kpi-icon is-accent">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
          </span>
        </div>
        <div class="kpi-seg-bar" aria-hidden="true">
          <div class="kpi-seg-item" style="width:${pctDoneProj}%; background:#15803d;"></div>
          <div class="kpi-seg-item" style="width:${pctTrackProj}%; background:#d97706;"></div>
          <div class="kpi-seg-item" style="width:${pctDelayProj}%; background:#dc2626;"></div>
        </div>
        <div class="kpi-breakdown" style="margin-top:10px;">
          <span class="kpi-pill">${counts.activeProjects} Active</span>
          <span class="kpi-pill">${counts.completedProjects} Done</span>
        </div>
      </div>

      <div class="kpi-card" data-kpi-nav="projects:Active" title="Filter active projects">
        <div class="kpi-visual-row">
          <div>
            <span class="kpi-label">Active Sites</span>
            <div class="kpi-value mono" style="margin-top:6px;">${counts.activeProjects}</div>
            <div class="kpi-breakdown">
              <span class="kpi-pill">${counts.onTrackProjects} On Track</span>
            </div>
          </div>
          ${renderSvgRadialRing(activeAvgProgress, {
            size: 58,
            stroke: 6,
            color: '#d97706',
            track: '#edeae2',
            textColor: '#14171a',
            fontSize: 12
          })}
        </div>
      </div>

      <div class="kpi-card" data-kpi-nav="projects:Completed" title="Filter completed projects">
        <div class="kpi-visual-row">
          <div>
            <span class="kpi-label">Completed</span>
            <div class="kpi-value mono" style="margin-top:6px;">${counts.completedProjects}</div>
            <div class="kpi-breakdown">
              <span class="kpi-pill">${counts.completedTasks}/${counts.totalTasks} Tasks</span>
            </div>
          </div>
          ${renderSvgRadialRing(completionPct, {
            size: 58,
            stroke: 6,
            color: '#15803d',
            track: '#edeae2',
            textColor: '#15803d',
            fontSize: 12
          })}
        </div>
      </div>

      <div class="kpi-card ${totalAlerts > 0 ? 'kpi-alert' : ''}" data-kpi-nav="delays:ALL" title="Open Delay Radar">
        <div class="kpi-visual-row">
          <div>
            <span class="kpi-label">Delayed Projects</span>
            <div class="kpi-value mono" style="margin-top:6px;">${counts.delayedProjects}</div>
          </div>
          ${totalAlerts > 0 ? '<span class="pulse-dot"></span>' : '<span class="badge badge-completed">Clear</span>'}
        </div>
        <div class="kpi-breakdown" style="margin-top:10px;">
          <span class="badge ${counts.delayedTasks > 0 ? 'badge-delayed' : 'badge-neutral'} mono">${counts.delayedTasks} Tasks</span>
          <span class="badge ${counts.delayedMaterials > 0 ? 'badge-delayed' : 'badge-neutral'} mono">${counts.delayedMaterials} Supplies</span>
        </div>
      </div>
    `;

    const gridEl = document.getElementById('dashboard-project-grid');
    if (!filteredReports.length) {
      gridEl.innerHTML = `<div class="panel" style="grid-column:1/-1;"><div class="empty-state"><h3 class="empty-state-title">No matching projects</h3><p class="empty-state-text">Clear search filter or click "+ New Project" to add a site.</p></div></div>`;
    } else {
      gridEl.innerHTML = filteredReports
        .map((rep) => {
          const p = rep.project;
          const ringColor =
            rep.status === 'Completed' ? '#22c55e' : rep.status === 'Delayed' ? '#ef4444' : '#f59e0b';

          const stepperHtml = rep.phaseStates
            .slice(0, 4)
            .map((ps) => {
              const cls =
                ps.status === 'Completed'
                  ? 'is-completed'
                  : ps.status === 'Delayed'
                  ? 'is-delayed'
                  : ps.status === 'Active'
                  ? 'is-active'
                  : '';
              const icon =
                ps.status === 'Completed' ? '&#10003;' : ps.status === 'Delayed' ? '!' : ps.status === 'Active' ? '&#9679;' : '&#9675;';
              const shortLabel = ps.phase.name.replace(/^\d+\.\s*/, '');
              return `
                <div class="milestone-node ${cls}" data-open-project="${escapeHtml(p.id)}" title="${escapeHtml(ps.phase.name)} (${ps.progress}%)">
                  <div class="milestone-dot">${icon}</div>
                  <div class="milestone-label">${escapeHtml(shortLabel)}</div>
                  <div class="milestone-pct">${ps.status === 'Delayed' ? `${ps.maxOverdueDays}d late` : `${ps.progress}%`}</div>
                </div>
              `;
            })
            .join('');

          return `
            <article class="dash-proj-card ${rep.status === 'Delayed' ? 'is-delayed' : ''}">
              <div class="dash-proj-hero" data-open-project="${escapeHtml(p.id)}">
                <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" />
                <div class="dash-proj-hero-overlay">
                  <div class="dash-proj-hero-top">
                    <span class="project-code-tag">${escapeHtml(p.code)}</span>
                    ${renderStatusBadge(rep.status)}
                  </div>
                  <div class="dash-proj-hero-bottom">
                    <div>
                      <h3 class="dash-proj-title">${escapeHtml(p.name)}</h3>
                      <div class="dash-proj-loc">${escapeHtml(p.location)}</div>
                    </div>
                    ${renderSvgRadialRing(rep.overallProgress, {
                      size: 48,
                      stroke: 5,
                      color: ringColor,
                      track: 'rgba(255,255,255,0.22)',
                      textColor: '#ffffff',
                      fontSize: 11
                    })}
                  </div>
                </div>
              </div>

              <div class="dash-proj-body">
                <div class="milestone-stepper">${stepperHtml}</div>
                <div class="dash-proj-foot">
                  <div style="display:flex; gap:10px; align-items:center;">
                    <span class="mono" style="font-weight:600;">${formatCompactCurrency(p.budget)}</span>
                    <span class="muted">&middot; ${escapeHtml(p.manager)}</span>
                  </div>
                  <button type="button" class="btn btn-secondary btn-xs" data-open-project="${escapeHtml(p.id)}">Manage Phases &rarr;</button>
                </div>
              </div>
            </article>
          `;
        })
        .join('');
    }

    document.querySelectorAll('[data-triage-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.triageTab === ui.delayTriageFilter);
    });

    const triageItems = [];
    if (ui.delayTriageFilter === 'ALL' || ui.delayTriageFilter === 'TASKS') {
      delayedTasks.forEach(({ task, delay }) => {
        const proj = state.projects.find((p) => p.id === task.projectId);
        const worker = state.workers.find((w) => w.id === task.workerId);
        triageItems.push({
          kind: 'Task',
          id: task.id,
          title: task.title,
          projName: proj ? proj.name : 'Project',
          owner: worker ? worker.teamName : 'Unassigned',
          initials: getInitials(worker ? worker.leadName : 'UN'),
          deadline: task.deadline,
          days: delay.daysOverdue,
          severity: delay.severity
        });
      });
    }
    if (ui.delayTriageFilter === 'ALL' || ui.delayTriageFilter === 'MATERIALS') {
      delayedMaterials.forEach(({ material, delay }) => {
        const proj = state.projects.find((p) => p.id === material.projectId);
        triageItems.push({
          kind: 'Material',
          id: material.id,
          title: `${material.name} (${delay.shortageQty} ${material.unit} short)`,
          projName: proj ? proj.name : 'Project',
          owner: material.supplier,
          initials: 'MT',
          deadline: material.deliveryDeadline,
          days: delay.daysOverdue,
          severity: delay.daysOverdue >= 5 ? 'Critical' : 'Overdue'
        });
      });
    }
    triageItems.sort((a, b) => b.days - a.days);

    const triageEl = document.getElementById('dashboard-delay-triage');
    if (!triageItems.length) {
      triageEl.innerHTML = `<div class="empty-state"><h3 class="empty-state-title">Zero Alerts in View</h3><p class="empty-state-text">Use the Time Scrubber (+15d) above to test upcoming schedule risks.</p></div>`;
    } else {
      triageEl.innerHTML = triageItems
        .slice(0, 5)
        .map((item) => {
          const meterPct = Math.min(100, Math.max(16, item.days * 14));
          return `
            <div class="triage-card">
              <div class="triage-top">
                <p class="triage-title">${escapeHtml(item.title)}</p>
                <span class="badge ${item.severity === 'Critical' ? 'badge-critical' : 'badge-delayed'} mono">${item.days}d LATE</span>
              </div>
              <div class="severity-meter" title="Overdue severity: ${item.days} days late">
                <div class="severity-meter-fill" style="width:${meterPct}%;"></div>
              </div>
              <div class="triage-bottom">
                <div class="triage-meta">
                  <span class="badge badge-neutral">${escapeHtml(item.kind)}</span>
                  <span>${escapeHtml(item.projName)}</span>
                  <span class="mono muted">Due ${escapeHtml(formatShortDate(item.deadline))}</span>
                </div>
                <div class="action-group">
                  ${
                    item.kind === 'Task'
                      ? `<button type="button" class="btn btn-success-soft btn-xs" data-complete-task="${escapeHtml(item.id)}">&#10003; Complete</button>
                         <button type="button" class="btn btn-secondary btn-xs" data-extend-task="${escapeHtml(item.id)}">+5d</button>`
                      : `<button type="button" class="btn btn-success-soft btn-xs" data-receive-material="${escapeHtml(item.id)}">&#10003; Receive Stock</button>`
                  }
                </div>
              </div>
            </div>
          `;
        })
        .join('');
    }

    const tradeMap = {};
    state.workers.forEach((w) => {
      tradeMap[w.trade] = (tradeMap[w.trade] || 0) + (Number(w.headcount) || 0);
    });
    const tradeEntries = Object.entries(tradeMap).sort((a, b) => b[1] - a[1]);
    const maxTradeHeadcount = Math.max(1, ...tradeEntries.map((x) => x[1]));

    const tradeBarsHtml = tradeEntries
      .map(([trade, headcount]) => {
        const pct = Math.round((headcount / maxTradeHeadcount) * 100);
        return `
          <div class="trade-chart-row">
            <div class="trade-chart-head">
              <span style="font-weight:600;">${escapeHtml(trade)}</span>
              <span class="mono muted">${headcount} workers</span>
            </div>
            <div class="trade-bar-track">
              <div class="trade-bar-fill" style="width:${pct}%;"></div>
            </div>
          </div>
        `;
      })
      .join('');

    const totalMatItems = state.materials.length;
    const fulfilledMatItems = state.materials.filter(
      (m) => Number(m.deliveredQty) >= Number(m.requiredQty)
    ).length;
    const matReadinessPct = totalMatItems ? Math.round((fulfilledMatItems / totalMatItems) * 100) : 100;
    const deployedPct = counts.totalHeadcount
      ? Math.round((counts.deployedHeadcount / counts.totalHeadcount) * 100)
      : 0;

    document.getElementById('dashboard-visual-charts').innerHTML = `
      <div class="trade-chart-list">${tradeBarsHtml}</div>
      <div class="bom-gauge-grid">
        <div class="bom-gauge-card">
          ${renderSvgRadialRing(deployedPct, {
            size: 54,
            stroke: 6,
            color: '#d95d24',
            track: '#e5e0d5',
            textColor: '#14171a',
            fontSize: 12
          })}
          <div>
            <div style="font-weight:700; font-size:13px;">Crew Active</div>
            <div class="mono muted" style="font-size:11.5px;">${counts.deployedHeadcount}/${counts.totalHeadcount} personnel</div>
          </div>
        </div>
        <div class="bom-gauge-card">
          ${renderSvgRadialRing(matReadinessPct, {
            size: 54,
            stroke: 6,
            color: '#15803d',
            track: '#e5e0d5',
            textColor: '#15803d',
            fontSize: 12
          })}
          <div>
            <div style="font-weight:700; font-size:13px;">BOM Fulfilled</div>
            <div class="mono muted" style="font-size:11.5px;">${fulfilledMatItems}/${totalMatItems} line items</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderProjectsView(analytics) {
    const q = ui.searchQuery.trim().toLowerCase();
    const { counts, projectReports } = analytics;

    const totalBudget = state.projects.reduce((s, p) => s + (Number(p.budget) || 0), 0);
    const avgProgress = projectReports.length
      ? Math.round(projectReports.reduce((s, r) => s + r.overallProgress, 0) / projectReports.length)
      : 0;
    const totalBudgetDenom = Math.max(1, totalBudget);
    const segColors = ['#d95d24', '#2563eb', '#15803d', '#d97706', '#7c3aed'];
    const budgetSegHtml = projectReports
      .map((r, idx) => {
        const w = Math.max(4, Math.round(((Number(r.project.budget) || 0) / totalBudgetDenom) * 100));
        return `<div class="kpi-seg-item" style="width:${w}%; background:${segColors[idx % segColors.length]};" title="${escapeHtml(r.project.name)}: ${formatCompactCurrency(r.project.budget)}"></div>`;
      })
      .join('');

    const telemetryEl = document.getElementById('projects-telemetry-strip');
    if (telemetryEl) {
      telemetryEl.innerHTML = `
        <div class="kpi-card">
          <div class="kpi-visual-row">
            <div>
              <span class="kpi-label">Portfolio Capital</span>
              <div class="kpi-value mono" style="margin-top:6px;">${formatCompactCurrency(totalBudget)}</div>
            </div>
            <span class="kpi-icon is-accent">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </span>
          </div>
          <div class="kpi-seg-bar">${budgetSegHtml}</div>
          <div class="kpi-breakdown" style="margin-top:10px;">
            <span class="kpi-pill">${counts.totalProjects} Total Sites</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-visual-row">
            <div>
              <span class="kpi-label">Avg Completion</span>
              <div class="kpi-value mono" style="margin-top:6px;">${avgProgress}%</div>
              <div class="kpi-breakdown">
                <span class="kpi-pill">${counts.activeProjects} Active In-Flight</span>
              </div>
            </div>
            ${renderSvgRadialRing(avgProgress, {
              size: 58,
              stroke: 6,
              color: '#d95d24',
              track: '#edeae2',
              textColor: '#14171a',
              fontSize: 12
            })}
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-visual-row">
            <div>
              <span class="kpi-label">On-Track &amp; Done</span>
              <div class="kpi-value mono" style="margin-top:6px;">${counts.onTrackProjects + counts.completedProjects}</div>
              <div class="kpi-breakdown">
                <span class="kpi-pill">${counts.onTrackProjects} On Track</span>
                <span class="kpi-pill">${counts.completedProjects} Handed Over</span>
              </div>
            </div>
            <span class="kpi-icon is-completed">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </span>
          </div>
        </div>

        <div class="kpi-card ${counts.delayedProjects > 0 ? 'kpi-alert' : ''}">
          <div class="kpi-visual-row">
            <div>
              <span class="kpi-label">Schedule Risk Sites</span>
              <div class="kpi-value mono" style="margin-top:6px;">${counts.delayedProjects}</div>
            </div>
            ${counts.delayedProjects > 0 ? '<span class="pulse-dot"></span>' : '<span class="badge badge-completed">Clear</span>'}
          </div>
          <div class="kpi-breakdown" style="margin-top:10px;">
            <span class="badge ${counts.delayedPhases > 0 ? 'badge-delayed' : 'badge-neutral'} mono">${counts.delayedPhases} Slipped Phases</span>
          </div>
        </div>
      `;
    }

    const list = projectReports.filter((rep) => {
      const p = rep.project;
      const matchesFilter = ui.projectFilter === 'ALL' || rep.status === ui.projectFilter;
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.client.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });

    const grid = document.getElementById('projects-grid');
    if (!list.length) {
      grid.innerHTML = `<div class="panel" style="grid-column:1/-1;"><div class="empty-state"><h3 class="empty-state-title">No projects match this filter</h3><p class="empty-state-text">Try selecting "All Projects" or create a new project.</p></div></div>`;
      return;
    }

    grid.innerHTML = list
      .map((rep) => {
        const p = rep.project;
        const ringColor =
          rep.status === 'Completed' ? '#22c55e' : rep.status === 'Delayed' ? '#ef4444' : '#f59e0b';

        const storedPhaseId = ui.selectedPhaseByProject[p.id];
        const activePs =
          rep.phaseStates.find((x) => x.phase.id === storedPhaseId) ||
          rep.phaseStates.find((x) => x.status === 'Delayed') ||
          rep.phaseStates.find((x) => x.status === 'Active') ||
          rep.phaseStates[0];

        const stepperHtml = rep.phaseStates
          .slice(0, 4)
          .map((ps) => {
            const cls =
              ps.status === 'Completed'
                ? 'is-completed'
                : ps.status === 'Delayed'
                ? 'is-delayed'
                : ps.status === 'Active'
                ? 'is-active'
                : '';
            const selectedCls = activePs && activePs.phase.id === ps.phase.id ? 'is-selected' : '';
            const icon =
              ps.status === 'Completed' ? '&#10003;' : ps.status === 'Delayed' ? '!' : ps.status === 'Active' ? '&#9679;' : '&#9675;';
            const shortName = ps.phase.name.replace(/^\d+\.\s*/, '');
            return `
              <div
                class="milestone-node ${cls} ${selectedCls}"
                data-select-card-phase="${escapeHtml(p.id)}|${escapeHtml(ps.phase.id)}"
                title="Click to inspect & adjust ${escapeHtml(ps.phase.name)}"
              >
                <div class="milestone-dot">${icon}</div>
                <div class="milestone-label">${escapeHtml(shortName)}</div>
                <div class="milestone-pct">${ps.status === 'Delayed' ? `${ps.maxOverdueDays}d late` : `${ps.progress}%`}</div>
              </div>
            `;
          })
          .join('');

        let inlinePhaseHtml = '';
        if (activePs) {
          const aph = activePs.phase;
          inlinePhaseHtml = `
            <div class="inline-phase-box ${activePs.status === 'Delayed' ? 'is-delayed' : ''}">
              <div class="inline-phase-header">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <strong style="font-size:12.5px;">${escapeHtml(aph.name)}</strong>
                  ${renderStatusBadge(activePs.status)}
                </div>
                <span class="mono muted" style="font-size:11.5px;">Due ${escapeHtml(formatShortDate(aph.deadline))}</span>
              </div>
              <div class="inline-phase-controls">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value="${activePs.progress}"
                  class="range-slider"
                  data-phase-slider="${escapeHtml(p.id)}|${escapeHtml(aph.id)}"
                  aria-label="Inline phase slider for ${escapeHtml(aph.name)}"
                />
                <span class="mono" data-phase-pct-label="${escapeHtml(aph.id)}" style="font-weight:700; min-width:38px; text-align:right;">${activePs.progress}%</span>
                ${
                  activePs.progress < 100
                    ? `<button type="button" class="btn btn-success-soft btn-xs" data-bump-phase="${escapeHtml(p.id)}|${escapeHtml(aph.id)}">+25%</button>`
                    : ''
                }
              </div>
            </div>
          `;
        }

        return `
          <article class="project-card">
            <div class="project-card-media" style="cursor:pointer;" data-open-project="${escapeHtml(p.id)}">
              <img class="project-card-img" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" />
              <div class="project-card-overlay">
                <div class="project-overlay-top">
                  <span class="project-code-tag">${escapeHtml(p.code)} &middot; ${escapeHtml(p.client)}</span>
                  ${renderStatusBadge(rep.status)}
                </div>
                <div class="project-overlay-bottom" style="display:flex; align-items:flex-end; justify-content:space-between; gap:12px;">
                  <div>
                    <h3 class="project-card-title">${escapeHtml(p.name)}</h3>
                    <div class="project-card-location">${escapeHtml(p.location)}</div>
                  </div>
                  ${renderSvgRadialRing(rep.overallProgress, {
                    size: 56,
                    stroke: 5,
                    color: ringColor,
                    track: 'rgba(255,255,255,0.22)',
                    textColor: '#ffffff',
                    fontSize: 12
                  })}
                </div>
              </div>
            </div>

            <div class="project-card-body">
              <div class="project-meta-strip">
                <div>
                  <div class="meta-cell-label">Budget</div>
                  <div class="meta-cell-value mono">${formatCompactCurrency(p.budget)}</div>
                </div>
                <div>
                  <div class="meta-cell-label">Site Lead</div>
                  <div class="meta-cell-value">${escapeHtml(p.manager)}</div>
                </div>
                <div>
                  <div class="meta-cell-label">Tasks Done</div>
                  <div class="meta-cell-value mono">${rep.completedTasks} / ${rep.totalTasks}</div>
                </div>
              </div>

              <div class="milestone-stepper">${stepperHtml}</div>
              ${inlinePhaseHtml}
            </div>

            <div class="project-card-footer">
              <div class="muted" style="font-size:12px;">
                ${
                  rep.delayedTasksCount > 0 || rep.delayedPhasesCount > 0
                    ? `<span style="color:var(--status-delayed); font-weight:600;">${rep.delayedTasksCount} overdue task(s) &middot; ${rep.delayedPhasesCount} slipped phase(s)</span>`
                    : `Target completion <span class="mono">${escapeHtml(formatShortDate(p.endDate))}</span>`
                }
              </div>
              <div class="action-group">
                <button type="button" class="btn btn-secondary btn-sm" data-edit-project="${escapeHtml(p.id)}">Edit</button>
                <button type="button" class="btn btn-primary btn-sm" data-open-project="${escapeHtml(p.id)}">Manage Phases</button>
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function renderTasksView(analytics) {
    const q = ui.searchQuery.trim().toLowerCase();
    const refDate = analytics.refDate;
    const { counts } = analytics;

    const doneRate = counts.totalTasks ? Math.round((counts.completedTasks / counts.totalTasks) * 100) : 0;
    const tasksTelEl = document.getElementById('tasks-telemetry-strip');
    if (tasksTelEl) {
      tasksTelEl.innerHTML = `
        <div class="kpi-card" data-quick-task-filter="ALL">
          <div class="kpi-visual-row">
            <div>
              <span class="kpi-label">Total Work Packages</span>
              <div class="kpi-value mono" style="margin-top:6px;">${counts.totalTasks}</div>
              <div class="kpi-breakdown"><span class="kpi-pill">${counts.pendingTasks} Queued</span></div>
            </div>
            <span class="kpi-icon is-accent">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </span>
          </div>
        </div>

        <div class="kpi-card ${counts.delayedTasks > 0 ? 'kpi-alert' : ''}" data-quick-task-filter="Delayed">
          <div class="kpi-visual-row">
            <div>
              <span class="kpi-label">Overdue Tasks</span>
              <div class="kpi-value mono" style="margin-top:6px;">${counts.delayedTasks}</div>
              <div class="kpi-breakdown"><span class="badge ${counts.delayedTasks > 0 ? 'badge-delayed' : 'badge-neutral'}">Auto-Flagged</span></div>
            </div>
            ${counts.delayedTasks > 0 ? '<span class="pulse-dot"></span>' : '<span class="badge badge-completed">0 Late</span>'}
          </div>
        </div>

        <div class="kpi-card" data-quick-task-filter="In Progress">
          <div class="kpi-visual-row">
            <div>
              <span class="kpi-label">Active Execution</span>
              <div class="kpi-value mono" style="margin-top:6px;">${counts.activeTasks}</div>
              <div class="kpi-breakdown"><span class="kpi-pill">Field Crews Active</span></div>
            </div>
            <span class="kpi-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </span>
          </div>
        </div>

        <div class="kpi-card" data-quick-task-filter="Completed">
          <div class="kpi-visual-row">
            <div>
              <span class="kpi-label">Completion Rate</span>
              <div class="kpi-value mono" style="margin-top:6px;">${counts.completedTasks}</div>
              <div class="kpi-breakdown"><span class="kpi-pill">Signed Off</span></div>
            </div>
            ${renderSvgRadialRing(doneRate, {
              size: 56,
              stroke: 6,
              color: '#15803d',
              track: '#edeae2',
              textColor: '#15803d',
              fontSize: 12
            })}
          </div>
        </div>
      `;
    }

    const filtered = state.tasks.filter((task) => {
      const delay = isTaskDelayed(task, refDate);
      const matchesProject =
        ui.taskProjectFilter === 'ALL' || task.projectId === ui.taskProjectFilter;

      let matchesStatus = true;
      if (ui.taskStatusFilter === 'Delayed') matchesStatus = delay.delayed;
      else if (ui.taskStatusFilter !== 'ALL') matchesStatus = task.status === ui.taskStatusFilter;

      const proj = state.projects.find((p) => p.id === task.projectId);
      const worker = state.workers.find((w) => w.id === task.workerId);
      const matchesSearch =
        !q ||
        task.title.toLowerCase().includes(q) ||
        task.code.toLowerCase().includes(q) ||
        (proj && proj.name.toLowerCase().includes(q)) ||
        (worker && worker.teamName.toLowerCase().includes(q));

      return matchesProject && matchesStatus && matchesSearch;
    });

    filtered.sort((a, b) => {
      const dA = isTaskDelayed(a, refDate);
      const dB = isTaskDelayed(b, refDate);
      if (dA.delayed !== dB.delayed) return dA.delayed ? -1 : 1;
      if (dA.delayed && dB.delayed) return dB.daysOverdue - dA.daysOverdue;
      if ((a.status === 'Completed') !== (b.status === 'Completed')) {
        return a.status === 'Completed' ? 1 : -1;
      }
      return (a.deadline || '').localeCompare(b.deadline || '');
    });

    const kanbanEl = document.getElementById('tasks-kanban-board');
    const tablePanel = document.getElementById('tasks-table-panel');
    document.querySelectorAll('[data-task-view-mode]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.taskViewMode === ui.taskViewMode);
    });
    if (kanbanEl && tablePanel) {
      kanbanEl.style.display = ui.taskViewMode === 'kanban' ? 'grid' : 'none';
      tablePanel.style.display = ui.taskViewMode === 'table' ? 'block' : 'none';
    }

    if (ui.taskViewMode === 'kanban' && kanbanEl) {
      const cols = [
        { key: 'delayed', title: 'Delayed Alerts', cls: 'col-delayed', items: [] },
        { key: 'active', title: 'In Progress', cls: 'col-active', items: [] },
        { key: 'pending', title: 'Pending Queue', cls: 'col-pending', items: [] },
        { key: 'completed', title: 'Completed', cls: 'col-completed', items: [] }
      ];

      filtered.forEach((task) => {
        const delay = isTaskDelayed(task, refDate);
        if (delay.delayed) cols[0].items.push({ task, delay });
        else if (task.status === 'In Progress') cols[1].items.push({ task, delay });
        else if (task.status === 'Completed') cols[3].items.push({ task, delay });
        else cols[2].items.push({ task, delay });
      });

      kanbanEl.innerHTML = cols
        .map((col) => {
          const cardsHtml = col.items.length
            ? col.items
                .map(({ task, delay }) => {
                  const proj = state.projects.find((p) => p.id === task.projectId);
                  const worker = state.workers.find((w) => w.id === task.workerId);
                  const nextAction =
                    task.status === 'Pending' ? 'Start' : task.status === 'In Progress' ? 'Complete' : 'Reopen';
                  const barPct = task.status === 'Completed' ? 100 : task.status === 'In Progress' ? 50 : 12;
                  const barColor = delay.delayed
                    ? '#dc2626'
                    : task.status === 'Completed'
                    ? '#15803d'
                    : task.status === 'In Progress'
                    ? '#d97706'
                    : '#94a3b8';
                  const tradeBg = worker ? getTradeColor(worker.trade) : '#475569';
                  const daysLeft = diffDays(task.deadline, refDate);
                  const duePill = delay.delayed
                    ? `${delay.daysOverdue}d LATE`
                    : task.status === 'Completed'
                    ? formatShortDate(task.deadline)
                    : daysLeft === 0
                    ? 'Due Today'
                    : `${daysLeft}d left`;

                  return `
                    <div class="kanban-card ${delay.delayed ? 'is-delayed' : ''}">
                      <div class="kanban-card-top">
                        <span class="mono muted" style="font-size:11px;">${escapeHtml(task.code)} &middot; ${escapeHtml(proj ? proj.code : '')}</span>
                        ${
                          delay.delayed
                            ? `<span class="badge badge-critical mono">${delay.daysOverdue}d LATE</span>`
                            : renderPriorityBadge(task.priority)
                        }
                      </div>
                      <div class="kanban-card-title">${escapeHtml(task.title)}</div>
                      <div class="kanban-progress-track">
                        <div class="kanban-progress-fill" style="width:${barPct}%; background:${barColor};"></div>
                      </div>
                      <div class="kanban-crew-row">
                        <span class="kanban-avatar" style="background:${tradeBg};">${escapeHtml(getInitials(worker ? worker.leadName : 'UN'))}</span>
                        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(worker ? worker.teamName : 'Unassigned')}</span>
                      </div>
                      <div class="kanban-card-foot">
                        <span class="mono" style="font-size:11px; color:${delay.delayed ? 'var(--status-delayed)' : 'var(--text-muted)'}; font-weight:600;">
                          ${escapeHtml(duePill)}
                        </span>
                        <div class="action-group">
                          <button type="button" class="btn ${task.status === 'Completed' ? 'btn-secondary' : 'btn-success-soft'} btn-xs" data-cycle-task="${escapeHtml(task.id)}">${nextAction}</button>
                          <button type="button" class="btn btn-secondary btn-xs" data-edit-task="${escapeHtml(task.id)}">Edit</button>
                        </div>
                      </div>
                    </div>
                  `;
                })
                .join('')
            : `<div class="muted" style="text-align:center; padding:24px 8px; font-size:12px;">No tasks in this lane</div>`;

          return `
            <div class="kanban-col ${col.cls}">
              <div class="kanban-col-head">
                <h3 class="kanban-col-title">${escapeHtml(col.title)}</h3>
                <span class="badge badge-neutral mono">${col.items.length}</span>
              </div>
              ${cardsHtml}
            </div>
          `;
        })
        .join('');
    }

    const tbody = document.getElementById('tasks-table-body');
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><h3 class="empty-state-title">No tasks found</h3><p class="empty-state-text">Adjust filters or click "+ Assign Task" to schedule new work.</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map((task) => {
        const proj = state.projects.find((p) => p.id === task.projectId);
        const phase = proj ? (proj.phases || []).find((ph) => ph.id === task.phaseId) : null;
        const worker = state.workers.find((w) => w.id === task.workerId);
        const delay = isTaskDelayed(task, refDate);

        const nextActionLabel =
          task.status === 'Pending' ? 'Start' : task.status === 'In Progress' ? 'Complete' : 'Reopen';

        return `
          <tr class="${delay.delayed ? 'row-delayed' : ''}">
            <td>
              <div class="mono muted" style="font-size:11px;">${escapeHtml(task.code)}</div>
              <div class="task-title-cell">${escapeHtml(task.title)}</div>
              <div class="task-desc-sub">${escapeHtml(task.description || '')}</div>
            </td>
            <td>
              <div style="font-weight:600;">${escapeHtml(proj ? proj.name : '—')}</div>
              <div class="muted" style="font-size:12px;">${escapeHtml(phase ? phase.name : '—')}</div>
            </td>
            <td>
              <div style="font-weight:600;">${escapeHtml(worker ? worker.teamName : 'Unassigned')}</div>
              <div class="muted" style="font-size:12px;">${escapeHtml(worker ? worker.leadName : '')}</div>
            </td>
            <td>
              <div class="mono" style="font-weight:600; color:${delay.delayed ? 'var(--status-delayed)' : 'var(--text-primary)'};">
                ${escapeHtml(formatShortDate(task.deadline))}
              </div>
              ${
                delay.delayed
                  ? `<div class="mono" style="font-size:11px; color:var(--status-delayed); font-weight:700;">Overdue by ${delay.daysOverdue}d</div>`
                  : ''
              }
            </td>
            <td>${renderPriorityBadge(task.priority)}</td>
            <td>
              <div style="display:flex; flex-direction:column; align-items:flex-start; gap:4px;">
                ${renderStatusBadge(task.status)}
                ${delay.delayed ? `<span class="badge badge-critical mono" style="font-size:10.5px;">DELAYED</span>` : ''}
              </div>
            </td>
            <td>
              <div class="action-group">
                <button type="button" class="btn ${task.status === 'Completed' ? 'btn-secondary' : 'btn-success-soft'} btn-xs" data-cycle-task="${escapeHtml(task.id)}">
                  ${nextActionLabel}
                </button>
                <button type="button" class="btn btn-secondary btn-xs" data-edit-task="${escapeHtml(task.id)}">Edit</button>
                <button type="button" class="btn btn-danger-soft btn-xs" data-delete-task="${escapeHtml(task.id)}" title="Delete task">&times;</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function renderDelayRadarView(analytics) {
    const { delayedTasks, delayedPhases, delayedMaterials, refDate } = analytics;
    const totalIssues = delayedTasks.length + delayedPhases.length + delayedMaterials.length;

    const riskDonutHtml = renderSvgDonutChart(
      [
        { label: 'Tasks', value: delayedTasks.length, color: '#ef4444' },
        { label: 'Phases', value: delayedPhases.length, color: '#f59e0b' },
        { label: 'Materials', value: delayedMaterials.length, color: '#d95d24' }
      ],
      String(totalIssues),
      'Breaches'
    );

    const heroEl = document.getElementById('delays-hero-deck');
    if (heroEl) {
      heroEl.innerHTML = `
        <div class="risk-command-card ${totalIssues > 0 ? 'has-risk' : 'is-clear'}">
          <div class="risk-command-info">
            <div style="display:flex; align-items:center; gap:10px;">
              ${totalIssues > 0 ? '<span class="pulse-dot"></span>' : ''}
              <h2 class="radar-title">${
                totalIssues > 0 ? 'Active Schedule Breaches Detected' : 'Zero Schedule Breaches'
              }</h2>
            </div>
            <p class="radar-sub" style="margin:0;">
              Automated deadline audit evaluated against <span class="mono" style="color:#fdba74;">${escapeHtml(formatShortDate(refDate))}</span>.
            </p>
            <div class="risk-metrics-pills">
              <span class="risk-pill-dark"><span style="color:#fca5a5;">&#9679;</span> ${delayedTasks.length} Overdue Tasks</span>
              <span class="risk-pill-dark"><span style="color:#fcd34d;">&#9679;</span> ${delayedPhases.length} Slipped Phases</span>
              <span class="risk-pill-dark"><span style="color:#fdba74;">&#9679;</span> ${delayedMaterials.length} Late Supplies</span>
            </div>
          </div>
          ${riskDonutHtml}
        </div>

        <div class="risk-scrubber-card">
          <div>
            <div class="kpi-label">Live Schedule Simulator</div>
            <h3 style="font-family:var(--font-display); font-size:16px; margin:4px 0;">Test Future Deadline Exposure</h3>
            <p class="muted" style="font-size:12.5px; margin:0;">
              Shift the evaluation date forward to forecast upcoming critical bottlenecks before they hit.
            </p>
          </div>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; padding-top:8px; border-top:1px solid var(--border-subtle);">
            <span class="mono" style="font-size:12px; font-weight:700; color:var(--accent-primary);">${escapeHtml(formatShortDate(refDate))}</span>
            <div class="action-group">
              <button type="button" class="btn btn-secondary btn-xs" data-shift-days="-7">-7d</button>
              <button type="button" class="btn btn-secondary btn-xs" data-shift-days="0">Today</button>
              <button type="button" class="btn btn-secondary btn-xs" data-shift-days="7">+7d</button>
              <button type="button" class="btn btn-primary btn-xs" data-shift-days="15">+15d</button>
              <button type="button" class="btn btn-secondary btn-xs" data-shift-days="30">+30d</button>
            </div>
          </div>
        </div>
      `;
    }

    document.querySelectorAll('[data-delay-filter]').forEach((b) => {
      b.classList.toggle('active', b.dataset.delayFilter === ui.delayRadarFilter);
    });
    document.querySelectorAll('[data-delay-view-mode]').forEach((b) => {
      b.classList.toggle('active', b.dataset.delayViewMode === ui.delayViewMode);
    });

    const cardsGridEl = document.getElementById('delays-visual-grid');
    const tableWrapEl = document.getElementById('delays-table-container');
    if (cardsGridEl && tableWrapEl) {
      cardsGridEl.style.display = ui.delayViewMode === 'cards' ? 'grid' : 'none';
      tableWrapEl.style.display = ui.delayViewMode === 'table' ? 'flex' : 'none';
    }

    if (ui.delayViewMode === 'cards' && cardsGridEl) {
      const cards = [];

      if (ui.delayRadarFilter === 'ALL' || ui.delayRadarFilter === 'TASKS') {
        delayedTasks.forEach(({ task, delay }) => {
          const proj = state.projects.find((p) => p.id === task.projectId);
          const phase = proj ? (proj.phases || []).find((ph) => ph.id === task.phaseId) : null;
          const worker = state.workers.find((w) => w.id === task.workerId);
          const meterPct = Math.min(100, Math.max(18, delay.daysOverdue * 14));
          cards.push(`
            <article class="delay-visual-card">
              <div class="delay-card-head">
                <div>
                  <span class="badge badge-delayed">Overdue Task &middot; ${escapeHtml(task.code)}</span>
                  <h3 class="delay-card-title">${escapeHtml(task.title)}</h3>
                </div>
                <span class="badge ${delay.severity === 'Critical' ? 'badge-critical' : 'badge-delayed'} mono">
                  ${delay.daysOverdue}d LATE
                </span>
              </div>
              <div class="severity-meter"><div class="severity-meter-fill" style="width:${meterPct}%;"></div></div>
              <div class="delay-card-meta-grid">
                <div>
                  <div class="meta-cell-label">Project</div>
                  <div class="meta-cell-value">${escapeHtml(proj ? proj.name : '—')}</div>
                </div>
                <div>
                  <div class="meta-cell-label">Assigned Crew</div>
                  <div class="meta-cell-value">${escapeHtml(worker ? worker.teamName : 'Unassigned')}</div>
                </div>
                <div>
                  <div class="meta-cell-label">Deadline</div>
                  <div class="meta-cell-value mono" style="color:var(--status-delayed);">${escapeHtml(formatShortDate(task.deadline))}</div>
                </div>
              </div>
              <div class="delay-card-foot">
                <span class="muted" style="font-size:12px;">Phase: ${escapeHtml(phase ? phase.name.replace(/^\d+\.\s*/, '') : '—')}</span>
                <div class="action-group">
                  <button type="button" class="btn btn-success-soft btn-xs" data-complete-task="${escapeHtml(task.id)}">&#10003; Complete</button>
                  <button type="button" class="btn btn-secondary btn-xs" data-extend-task="${escapeHtml(task.id)}">+5d Extend</button>
                  <button type="button" class="btn btn-secondary btn-xs" data-edit-task="${escapeHtml(task.id)}">Edit</button>
                </div>
              </div>
            </article>
          `);
        });
      }

      if (ui.delayRadarFilter === 'ALL' || ui.delayRadarFilter === 'PHASES') {
        delayedPhases.forEach(({ project, phaseState }) => {
          const reasons = [];
          if (phaseState.deadlineSlipped) reasons.push(`Deadline slipped ${phaseState.phaseDeadlineDays}d`);
          if (phaseState.delayedTasksCount > 0) reasons.push(`${phaseState.delayedTasksCount} overdue task(s)`);
          cards.push(`
            <article class="delay-visual-card" style="border-left-color:#d97706;">
              <div class="delay-card-head">
                <div>
                  <span class="badge badge-active">Delayed Work Phase</span>
                  <h3 class="delay-card-title">${escapeHtml(phaseState.phase.name)}</h3>
                </div>
                ${renderSvgRadialRing(phaseState.progress, {
                  size: 46,
                  stroke: 5,
                  color: '#dc2626',
                  track: '#fee2e2',
                  textColor: '#dc2626',
                  fontSize: 11
                })}
              </div>
              <div class="delay-card-meta-grid">
                <div>
                  <div class="meta-cell-label">Project</div>
                  <div class="meta-cell-value">${escapeHtml(project.name)}</div>
                </div>
                <div>
                  <div class="meta-cell-label">Phase Deadline</div>
                  <div class="meta-cell-value mono">${escapeHtml(formatShortDate(phaseState.phase.deadline))}</div>
                </div>
                <div>
                  <div class="meta-cell-label">Trigger</div>
                  <div class="meta-cell-value" style="color:var(--status-delayed);">${escapeHtml(reasons.join(' · '))}</div>
                </div>
              </div>
              <div class="delay-card-foot">
                <span class="muted" style="font-size:12px;">${phaseState.tasks.length} linked tasks</span>
                <div class="action-group">
                  <button type="button" class="btn btn-success-soft btn-xs" data-bump-phase="${escapeHtml(project.id)}|${escapeHtml(phaseState.phase.id)}">+25% Stage</button>
                  <button type="button" class="btn btn-primary btn-xs" data-open-project="${escapeHtml(project.id)}">Inspect Phase</button>
                </div>
              </div>
            </article>
          `);
        });
      }

      if (ui.delayRadarFilter === 'ALL' || ui.delayRadarFilter === 'MATERIALS') {
        delayedMaterials.forEach(({ material, delay }) => {
          const proj = state.projects.find((p) => p.id === material.projectId);
          const delPct = Math.min(100, Math.round(((Number(material.deliveredQty) || 0) / Math.max(1, Number(material.requiredQty))) * 100));
          cards.push(`
            <article class="delay-visual-card">
              <div class="delay-card-head">
                <div>
                  <span class="badge badge-critical">Late Supply &middot; ${escapeHtml(material.code)}</span>
                  <h3 class="delay-card-title">${escapeHtml(material.name)}</h3>
                </div>
                <span class="badge badge-critical mono">${delay.daysOverdue}d LATE</span>
              </div>
              <div class="stock-bar-wrap">
                <div class="stock-bar-label">
                  <span>Delivered: ${material.deliveredQty}/${material.requiredQty} ${escapeHtml(material.unit)}</span>
                  <span style="color:var(--status-delayed);">Short ${delay.shortageQty} ${escapeHtml(material.unit)}</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill is-delayed" style="width:${delPct}%;"></div>
                </div>
              </div>
              <div class="delay-card-meta-grid">
                <div>
                  <div class="meta-cell-label">Project</div>
                  <div class="meta-cell-value">${escapeHtml(proj ? proj.name : '—')}</div>
                </div>
                <div>
                  <div class="meta-cell-label">Supplier</div>
                  <div class="meta-cell-value">${escapeHtml(material.supplier)}</div>
                </div>
                <div>
                  <div class="meta-cell-label">Expected By</div>
                  <div class="meta-cell-value mono" style="color:var(--status-delayed);">${escapeHtml(formatShortDate(material.deliveryDeadline))}</div>
                </div>
              </div>
              <div class="delay-card-foot">
                <span class="muted" style="font-size:12px;">BOM Supply Bottleneck</span>
                <div class="action-group">
                  <button type="button" class="btn btn-success-soft btn-xs" data-receive-material="${escapeHtml(material.id)}">&#10003; Receive Full Stock</button>
                </div>
              </div>
            </article>
          `);
        });
      }

      cardsGridEl.innerHTML = cards.length
        ? cards.join('')
        : `<div class="panel" style="grid-column:1/-1;"><div class="empty-state"><h3 class="empty-state-title">No Breaches in Selected Category</h3><p class="empty-state-text">Everything in this category is on schedule for ${escapeHtml(formatShortDate(refDate))}.</p></div></div>`;
    }

    const tasksBody = document.getElementById('delay-tasks-body');
    if (!delayedTasks.length) {
      tasksBody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><h3 class="empty-state-title">No Overdue Tasks</h3><p class="empty-state-text">All tasks before ${escapeHtml(formatShortDate(refDate))} are completed.</p></div></td></tr>`;
    } else {
      tasksBody.innerHTML = delayedTasks
        .map(({ task, delay }) => {
          const proj = state.projects.find((p) => p.id === task.projectId);
          const phase = proj ? (proj.phases || []).find((ph) => ph.id === task.phaseId) : null;
          const worker = state.workers.find((w) => w.id === task.workerId);
          return `
            <tr class="row-delayed">
              <td>
                <div class="mono muted" style="font-size:11px;">${escapeHtml(task.code)}</div>
                <div class="task-title-cell">${escapeHtml(task.title)}</div>
              </td>
              <td>
                <div style="font-weight:600;">${escapeHtml(proj ? proj.name : '—')}</div>
                <div class="muted" style="font-size:12px;">${escapeHtml(phase ? phase.name : '—')}</div>
              </td>
              <td>${escapeHtml(worker ? worker.teamName : 'Unassigned')}</td>
              <td class="mono" style="color:var(--status-delayed); font-weight:600;">${escapeHtml(formatShortDate(task.deadline))}</td>
              <td>
                <span class="badge ${delay.severity === 'Critical' ? 'badge-critical' : 'badge-delayed'} mono">
                  ${escapeHtml(delay.severity.toUpperCase())} &middot; ${delay.daysOverdue}d LATE
                </span>
              </td>
              <td>${renderStatusBadge(task.status)}</td>
              <td>
                <div class="action-group">
                  <button type="button" class="btn btn-success-soft btn-xs" data-complete-task="${escapeHtml(task.id)}">Mark Completed</button>
                  <button type="button" class="btn btn-secondary btn-xs" data-extend-task="${escapeHtml(task.id)}">+5d Reschedule</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join('');
    }

    const pmBody = document.getElementById('delay-phases-materials-body');
    const rows = [];
    delayedPhases.forEach(({ project, phaseState }) => {
      const reasons = [];
      if (phaseState.deadlineSlipped) reasons.push(`Phase deadline missed by ${phaseState.phaseDeadlineDays}d`);
      if (phaseState.delayedTasksCount > 0) reasons.push(`${phaseState.delayedTasksCount} overdue child task(s)`);
      rows.push(`
        <tr class="row-delayed">
          <td><span class="badge badge-delayed">Work Phase</span></td>
          <td>
            <div class="task-title-cell">${escapeHtml(phaseState.phase.name)}</div>
            <div class="muted" style="font-size:12px;">${escapeHtml(project.name)}</div>
          </td>
          <td class="mono">${escapeHtml(formatShortDate(phaseState.phase.deadline))}</td>
          <td class="mono">${phaseState.progress}% complete</td>
          <td style="color:var(--status-delayed); font-weight:600;">${escapeHtml(reasons.join(' + '))}</td>
          <td>
            <button type="button" class="btn btn-primary btn-xs" data-open-project="${escapeHtml(project.id)}">Inspect Phase</button>
          </td>
        </tr>
      `);
    });
    delayedMaterials.forEach(({ material, delay }) => {
      const proj = state.projects.find((p) => p.id === material.projectId);
      rows.push(`
        <tr class="row-delayed">
          <td><span class="badge badge-critical">Material Supply</span></td>
          <td>
            <div class="task-title-cell">${escapeHtml(material.name)}</div>
            <div class="muted" style="font-size:12px;">${escapeHtml(proj ? proj.name : '—')} &middot; ${escapeHtml(material.supplier)}</div>
          </td>
          <td class="mono">${escapeHtml(formatShortDate(material.deliveryDeadline))}</td>
          <td class="mono">${material.deliveredQty} / ${material.requiredQty} ${escapeHtml(material.unit)}</td>
          <td style="color:var(--status-delayed); font-weight:600;">Short by ${delay.shortageQty} ${escapeHtml(material.unit)} (${delay.daysOverdue}d late)</td>
          <td>
            <button type="button" class="btn btn-success-soft btn-xs" data-receive-material="${escapeHtml(material.id)}">Receive Full Batch</button>
          </td>
        </tr>
      `);
    });

    pmBody.innerHTML = rows.length
      ? rows.join('')
      : `<tr><td colspan="6"><div class="empty-state"><h3 class="empty-state-title">No Delayed Phases or Materials</h3><p class="empty-state-text">All construction phases and supply orders are on schedule.</p></div></td></tr>`;
  }

  function renderWorkersView(analytics) {
    const q = ui.searchQuery.trim().toLowerCase();
    const refDate = analytics.refDate;
    const { counts } = analytics;

    const totalDailyBurn = state.workers
      .filter((w) => w.status === 'On Site' || w.status === 'Assigned')
      .reduce((sum, w) => sum + (Number(w.dailyRate) || 0), 0);
    const onSiteHeadcount = state.workers
      .filter((w) => w.status === 'On Site')
      .reduce((sum, w) => sum + (Number(w.headcount) || 0), 0);
    const assignedHeadcount = state.workers
      .filter((w) => w.status === 'Assigned')
      .reduce((sum, w) => sum + (Number(w.headcount) || 0), 0);
    const standbyHeadcount = Math.max(0, counts.totalHeadcount - onSiteHeadcount - assignedHeadcount);
    const deployedPct = counts.totalHeadcount ? Math.round((counts.deployedHeadcount / counts.totalHeadcount) * 100) : 0;
    const crewsWithDelays = state.workers.filter((w) =>
      state.tasks.some((t) => t.workerId === w.id && isTaskDelayed(t, refDate).delayed)
    ).length;

    const workersTelEl = document.getElementById('workers-telemetry-strip');
    if (workersTelEl) {
      const denom = Math.max(1, counts.totalHeadcount);
      workersTelEl.innerHTML = `
        <div class="kpi-card">
          <div class="kpi-visual-row">
            <div>
              <span class="kpi-label">Total Field Personnel</span>
              <div class="kpi-value mono" style="margin-top:6px;">${counts.totalHeadcount}</div>
            </div>
            <span class="kpi-icon is-accent">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            </span>
          </div>
          <div class="kpi-seg-bar">
            <div class="kpi-seg-item" style="width:${Math.round((onSiteHeadcount / denom) * 100)}%; background:#15803d;"></div>
            <div class="kpi-seg-item" style="width:${Math.round((assignedHeadcount / denom) * 100)}%; background:#d97706;"></div>
            <div class="kpi-seg-item" style="width:${Math.round((standbyHeadcount / denom) * 100)}%; background:#94a3b8;"></div>
          </div>
          <div class="kpi-breakdown" style="margin-top:10px;">
            <span class="kpi-pill">${onSiteHeadcount} On Site</span>
            <span class="kpi-pill">${standbyHeadcount} Standby</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-visual-row">
            <div>
              <span class="kpi-label">Active Deployment</span>
              <div class="kpi-value mono" style="margin-top:6px;">${state.workers.length} Crews</div>
              <div class="kpi-breakdown"><span class="kpi-pill">${counts.deployedHeadcount} Active Hands</span></div>
            </div>
            ${renderSvgRadialRing(deployedPct, {
              size: 56,
              stroke: 6,
              color: '#d95d24',
              track: '#edeae2',
              textColor: '#14171a',
              fontSize: 12
            })}
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-visual-row">
            <div>
              <span class="kpi-label">Daily Crew Payroll</span>
              <div class="kpi-value mono" style="margin-top:6px;">${formatCompactCurrency(totalDailyBurn)}</div>
              <div class="kpi-breakdown"><span class="kpi-pill">Active Shift Burn / Day</span></div>
            </div>
            <span class="kpi-icon is-completed">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>
            </span>
          </div>
        </div>

        <div class="kpi-card ${crewsWithDelays > 0 ? 'kpi-alert' : ''}">
          <div class="kpi-visual-row">
            <div>
              <span class="kpi-label">Crews w/ Bottlenecks</span>
              <div class="kpi-value mono" style="margin-top:6px;">${crewsWithDelays}</div>
            </div>
            ${crewsWithDelays > 0 ? '<span class="pulse-dot"></span>' : '<span class="badge badge-completed">Clear</span>'}
          </div>
          <div class="kpi-breakdown" style="margin-top:10px;">
            <span class="badge ${crewsWithDelays > 0 ? 'badge-delayed' : 'badge-neutral'}">${crewsWithDelays} Need Support</span>
          </div>
        </div>
      `;
    }

    const list = state.workers.filter((w) => {
      const matchesFilter = ui.workerFilter === 'ALL' || w.status === ui.workerFilter;
      const matchesSpec = ui.workerSpecialtyFilter === 'ALL' || w.trade === ui.workerSpecialtyFilter;
      const matchesSearch =
        !q ||
        w.teamName.toLowerCase().includes(q) ||
        w.leadName.toLowerCase().includes(q) ||
        w.trade.toLowerCase().includes(q) ||
        w.code.toLowerCase().includes(q);
      return matchesFilter && matchesSpec && matchesSearch;
    });

    const grid = document.getElementById('workers-grid');
    if (!list.length) {
      grid.innerHTML = `<div class="panel" style="grid-column:1/-1;"><div class="empty-state"><h3 class="empty-state-title">No crew records found</h3><p class="empty-state-text">Try clearing your search or add a new workforce team.</p></div></div>`;
      return;
    }

    grid.innerHTML = list
      .map((w) => {
        const proj = state.projects.find((p) => p.id === w.primaryProjectId);
        const crewTasks = state.tasks.filter((t) => t.workerId === w.id);
        const completedCount = crewTasks.filter((t) => t.status === 'Completed').length;
        const overdueCount = crewTasks.filter((t) => isTaskDelayed(t, refDate).delayed).length;
        const activeCount = crewTasks.filter((t) => t.status !== 'Completed').length;
        const totalCrewTasks = Math.max(1, crewTasks.length);
        const tradeColor = getTradeColor(w.trade);
        const beaconCls =
          w.status === 'On Site' ? 'is-onsite' : w.status === 'Assigned' ? 'is-assigned' : '';

        return `
          <article class="worker-card">
            <div class="worker-trade-stripe" style="background:${tradeColor};"></div>
            <div class="worker-header">
              <div class="worker-identity">
                <div class="worker-avatar-wrap">
                  <div class="worker-avatar" style="background:${tradeColor};">${escapeHtml(getInitials(w.leadName))}</div>
                  <span class="status-beacon ${beaconCls}" title="${escapeHtml(w.status)}"></span>
                </div>
                <div>
                  <div class="mono muted" style="font-size:11px;">${escapeHtml(w.code)} &middot; ${escapeHtml(w.trade)}</div>
                  <h3 class="worker-name">${escapeHtml(w.teamName)}</h3>
                  <div class="worker-lead">Foreman: ${escapeHtml(w.leadName)}</div>
                </div>
              </div>
              ${renderStatusBadge(w.status)}
            </div>

            <div class="worker-details">
              <div>
                <div class="meta-cell-label">Headcount</div>
                <div class="meta-cell-value mono">${w.headcount} workers</div>
              </div>
              <div>
                <div class="meta-cell-label">Daily Rate</div>
                <div class="meta-cell-value mono">$${Number(w.dailyRate || 0).toLocaleString('en-US')}/day</div>
              </div>
              <div>
                <div class="meta-cell-label">Primary Site</div>
                <div class="meta-cell-value">${escapeHtml(proj ? proj.name : 'Pool / Unassigned')}</div>
              </div>
              <div>
                <div class="meta-cell-label">Safety Cert</div>
                <div><span class="cert-chip">&#10003; ${escapeHtml(w.certId || 'VERIFIED')}</span></div>
              </div>
              <div style="grid-column: 1 / -1;">
                <div class="meta-cell-label">Field Contact</div>
                <div class="meta-cell-value mono">${escapeHtml(w.phone)}</div>
              </div>
            </div>

            <div class="workload-bar-wrap">
              <div style="display:flex; justify-content:space-between; font-size:11.5px;">
                <span class="muted">Task Load (${crewTasks.length} total)</span>
                <span class="mono">${completedCount} done &middot; ${activeCount} open</span>
              </div>
              <div class="workload-bar-track">
                <div style="width:${Math.round((completedCount / totalCrewTasks) * 100)}%; background:#15803d;"></div>
                <div style="width:${Math.round(((activeCount - overdueCount) / totalCrewTasks) * 100)}%; background:#d97706;"></div>
                <div style="width:${Math.round((overdueCount / totalCrewTasks) * 100)}%; background:#dc2626;"></div>
              </div>
            </div>

            <div class="worker-stats-row">
              <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                <span class="badge badge-neutral mono">${activeCount} Active Task${activeCount === 1 ? '' : 's'}</span>
                ${
                  overdueCount > 0
                    ? `<span class="badge badge-delayed mono">${overdueCount} Delayed</span>`
                    : ''
                }
              </div>
              <div class="action-group">
                <button type="button" class="btn btn-primary btn-xs" data-assign-worker-task="${escapeHtml(w.id)}">+ Task</button>
                <button type="button" class="btn btn-secondary btn-xs" data-cycle-worker="${escapeHtml(w.id)}" title="Cycle status">Status</button>
                <button type="button" class="btn btn-secondary btn-xs" data-edit-worker="${escapeHtml(w.id)}">Edit</button>
                <button type="button" class="btn btn-danger-soft btn-xs" data-delete-worker="${escapeHtml(w.id)}" title="Remove crew">&times;</button>
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function renderMaterialsView(analytics) {
    const q = ui.searchQuery.trim().toLowerCase();
    const refDate = analytics.refDate;

    const totalItems = state.materials.length;
    const totalValue = state.materials.reduce(
      (sum, m) => sum + (Number(m.requiredQty) || 0) * (Number(m.unitCost) || 0),
      0
    );
    const fulfilledItems = state.materials.filter(
      (m) => Number(m.deliveredQty) >= Number(m.requiredQty)
    ).length;
    const pendingItems = totalItems - fulfilledItems;
    const overdueCount = analytics.delayedMaterials.length;
    const fulfillmentPct = totalItems ? Math.round((fulfilledItems / totalItems) * 100) : 100;

    document.getElementById('materials-summary-strip').innerHTML = `
      <div class="kpi-card">
        <div class="kpi-visual-row">
          <div>
            <span class="kpi-label">BOM Valuation</span>
            <div class="kpi-value mono" style="margin-top:6px;">${formatCompactCurrency(totalValue)}</div>
            <div class="kpi-breakdown"><span class="kpi-pill">${totalItems} Line Items</span></div>
          </div>
          <span class="kpi-icon is-accent">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          </span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-visual-row">
          <div>
            <span class="kpi-label">Stock Readiness</span>
            <div class="kpi-value mono" style="margin-top:6px;">${fulfilledItems}/${totalItems}</div>
            <div class="kpi-breakdown"><span class="kpi-pill">Items Fulfilled</span></div>
          </div>
          ${renderSvgRadialRing(fulfillmentPct, {
            size: 56,
            stroke: 6,
            color: '#15803d',
            track: '#edeae2',
            textColor: '#15803d',
            fontSize: 12
          })}
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-visual-row">
          <div>
            <span class="kpi-label">In-Transit Batches</span>
            <div class="kpi-value mono" style="margin-top:6px;">${pendingItems}</div>
            <div class="kpi-breakdown"><span class="kpi-pill">Awaiting Site Drop</span></div>
          </div>
          <span class="kpi-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          </span>
        </div>
      </div>

      <div class="kpi-card ${overdueCount > 0 ? 'kpi-alert' : ''}">
        <div class="kpi-visual-row">
          <div>
            <span class="kpi-label">Overdue Deliveries</span>
            <div class="kpi-value mono" style="margin-top:6px;">${overdueCount}</div>
          </div>
          ${overdueCount > 0 ? '<span class="pulse-dot"></span>' : '<span class="badge badge-completed">On Time</span>'}
        </div>
        <div class="kpi-breakdown" style="margin-top:10px;">
          <span class="badge ${overdueCount > 0 ? 'badge-critical' : 'badge-neutral'}">${overdueCount} Supply Alerts</span>
        </div>
      </div>
    `;

    const filtered = state.materials.filter((m) => {
      const delay = isMaterialDelayed(m, refDate);
      const isFulfilled = Number(m.deliveredQty) >= Number(m.requiredQty);
      const matchesProj =
        ui.materialProjectFilter === 'ALL' || m.projectId === ui.materialProjectFilter;

      let matchesStatus = true;
      if (ui.materialFilter === 'Delayed') matchesStatus = delay.delayed;
      else if (ui.materialFilter === 'Shortage') matchesStatus = !isFulfilled;
      else if (ui.materialFilter === 'Fulfilled') matchesStatus = isFulfilled;

      const proj = state.projects.find((p) => p.id === m.projectId);
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        m.supplier.toLowerCase().includes(q) ||
        (proj && proj.name.toLowerCase().includes(q));

      return matchesProj && matchesStatus && matchesSearch;
    });

    const cardsGrid = document.getElementById('materials-cards-grid');
    const tablePanel = document.getElementById('materials-table-panel');
    document.querySelectorAll('[data-mat-view-mode]').forEach((b) => {
      b.classList.toggle('active', b.dataset.matViewMode === ui.materialViewMode);
    });
    if (cardsGrid && tablePanel) {
      cardsGrid.style.display = ui.materialViewMode === 'cards' ? 'grid' : 'none';
      tablePanel.style.display = ui.materialViewMode === 'table' ? 'block' : 'none';
    }

    if (ui.materialViewMode === 'cards' && cardsGrid) {
      if (!filtered.length) {
        cardsGrid.innerHTML = `<div class="panel" style="grid-column:1/-1;"><div class="empty-state"><h3 class="empty-state-title">No material records found</h3><p class="empty-state-text">Adjust filters or click "+ Add Material Req" to log site materials.</p></div></div>`;
      } else {
        cardsGrid.innerHTML = filtered
          .map((m) => {
            const proj = state.projects.find((p) => p.id === m.projectId);
            const phase = proj ? (proj.phases || []).find((ph) => ph.id === m.phaseId) : null;
            const delay = isMaterialDelayed(m, refDate);
            const req = Math.max(1, Number(m.requiredQty) || 1);
            const del = Number(m.deliveredQty) || 0;
            const con = Math.min(del, Number(m.consumedQty) || 0);
            const delPct = Math.min(100, Math.round((del / req) * 100));
            const conPct = Math.min(100, Math.round((con / req) * 100));
            const fulfilled = del >= req;
            const ringColor = fulfilled ? '#15803d' : delay.delayed ? '#dc2626' : '#d97706';
            const lineValue = req * (Number(m.unitCost) || 0);

            return `
              <article class="mat-card ${delay.delayed ? 'is-delayed' : ''}">
                <div class="mat-card-head">
                  <div>
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                      <span class="mono muted" style="font-size:11px;">${escapeHtml(m.code)}</span>
                      <span class="badge badge-neutral">${escapeHtml(m.category)}</span>
                      ${
                        fulfilled
                          ? '<span class="badge badge-completed">Fulfilled</span>'
                          : delay.delayed
                          ? `<span class="badge badge-critical mono">${delay.daysOverdue}d LATE</span>`
                          : `<span class="badge badge-active">Short ${req - del} ${escapeHtml(m.unit)}</span>`
                      }
                    </div>
                    <h3 class="mat-card-title">${escapeHtml(m.name)}</h3>
                    <div class="muted" style="font-size:12px;">${escapeHtml(proj ? proj.name : '—')} &middot; ${escapeHtml(phase ? phase.name.replace(/^\d+\.\s*/, '') : 'General')}</div>
                  </div>
                  ${renderSvgRadialRing(delPct, {
                    size: 54,
                    stroke: 5,
                    color: ringColor,
                    track: '#edeae2',
                    textColor: ringColor,
                    fontSize: 12
                  })}
                </div>

                <div>
                  <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:5px;">
                    <span>Delivered: <strong class="mono">${del} / ${req} ${escapeHtml(m.unit)}</strong></span>
                    <span class="mono muted">Used: ${con} ${escapeHtml(m.unit)}</span>
                  </div>
                  <div class="mat-dual-track" title="Green/Amber/Red = Delivered vs Required, Dark Overlay = Consumed on site">
                    <div class="mat-delivered-fill ${delay.delayed ? 'is-delayed' : fulfilled ? '' : 'is-pending'}" style="width:${delPct}%;"></div>
                    <div class="mat-consumed-fill" style="width:${conPct}%;"></div>
                  </div>
                </div>

                <div class="mat-gauge-row">
                  <div>
                    <div class="meta-cell-label">Supplier</div>
                    <div class="meta-cell-value">${escapeHtml(m.supplier)}</div>
                  </div>
                  <div>
                    <div class="meta-cell-label">Due Date</div>
                    <div class="meta-cell-value mono" style="color:${delay.delayed ? 'var(--status-delayed)' : 'var(--text-primary)'};">${escapeHtml(formatShortDate(m.deliveryDeadline))}</div>
                  </div>
                  <div>
                    <div class="meta-cell-label">Est. Value</div>
                    <div class="meta-cell-value mono">${formatCompactCurrency(lineValue)}</div>
                  </div>
                </div>

                <div class="mat-card-foot">
                  <div class="action-group">
                    ${
                      !fulfilled
                        ? `<button type="button" class="btn btn-success-soft btn-xs" data-receive-batch="${escapeHtml(m.id)}">+ Receive</button>
                           <button type="button" class="btn btn-secondary btn-xs" data-receive-material="${escapeHtml(m.id)}">&#10003; Fulfill</button>`
                        : ''
                    }
                    ${
                      con < del
                        ? `<button type="button" class="btn btn-secondary btn-xs" data-consume-material="${escapeHtml(m.id)}">+ Log Usage</button>`
                        : ''
                    }
                  </div>
                  <div class="action-group">
                    <button type="button" class="btn btn-secondary btn-xs" data-edit-material="${escapeHtml(m.id)}">Edit</button>
                    <button type="button" class="btn btn-danger-soft btn-xs" data-delete-material="${escapeHtml(m.id)}" title="Delete material">&times;</button>
                  </div>
                </div>
              </article>
            `;
          })
          .join('');
      }
    }

    const tbody = document.getElementById('materials-table-body');
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><h3 class="empty-state-title">No material records found</h3><p class="empty-state-text">Adjust filters or click "+ Add Material Req" to log site materials.</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map((m) => {
        const proj = state.projects.find((p) => p.id === m.projectId);
        const phase = proj ? (proj.phases || []).find((ph) => ph.id === m.phaseId) : null;
        const delay = isMaterialDelayed(m, refDate);
        const req = Number(m.requiredQty) || 1;
        const del = Number(m.deliveredQty) || 0;
        const pct = Math.min(100, Math.round((del / req) * 100));
        const fulfilled = del >= req;

        return `
          <tr class="${delay.delayed ? 'row-delayed' : ''}">
            <td>
              <div class="mono muted" style="font-size:11px;">${escapeHtml(m.code)} &middot; ${escapeHtml(m.category)}</div>
              <div class="task-title-cell">${escapeHtml(m.name)}</div>
            </td>
            <td>
              <div style="font-weight:600;">${escapeHtml(proj ? proj.name : '—')}</div>
              <div class="muted" style="font-size:12px;">${escapeHtml(phase ? phase.name : 'General Site')}</div>
            </td>
            <td>
              <div class="stock-bar-wrap">
                <div class="stock-bar-label">
                  <span>${del} / ${req} ${escapeHtml(m.unit)}</span>
                  <span>${pct}%</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill ${fulfilled ? 'is-completed' : delay.delayed ? 'is-delayed' : 'is-active'}" style="width:${pct}%;"></div>
                </div>
              </div>
            </td>
            <td class="mono">${m.consumedQty || 0} ${escapeHtml(m.unit)}</td>
            <td>
              <div>${escapeHtml(m.supplier)}</div>
              <div class="mono" style="font-size:12px; color:${delay.delayed ? 'var(--status-delayed)' : 'var(--text-muted)'};">
                Due ${escapeHtml(formatShortDate(m.deliveryDeadline))}
              </div>
            </td>
            <td>
              ${
                fulfilled
                  ? '<span class="badge badge-completed">Fulfilled</span>'
                  : delay.delayed
                  ? `<span class="badge badge-critical mono">DELAYED (${delay.daysOverdue}d)</span>`
                  : `<span class="badge badge-active">Shortage: ${req - del} ${escapeHtml(m.unit)}</span>`
              }
            </td>
            <td>
              <div class="action-group">
                ${
                  !fulfilled
                    ? `<button type="button" class="btn btn-success-soft btn-xs" data-receive-batch="${escapeHtml(m.id)}">+ Receive</button>`
                    : ''
                }
                <button type="button" class="btn btn-secondary btn-xs" data-edit-material="${escapeHtml(m.id)}">Edit</button>
                <button type="button" class="btn btn-danger-soft btn-xs" data-delete-material="${escapeHtml(m.id)}" title="Delete material">&times;</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function populateFilterDropdowns() {
    const taskProjSelect = document.getElementById('task-project-filter');
    const matProjSelect = document.getElementById('material-project-filter');
    const workerSpecSelect = document.getElementById('worker-specialty-filter');

    const options =
      '<option value="ALL">All Projects</option>' +
      state.projects
        .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`)
        .join('');

    if (taskProjSelect) {
      taskProjSelect.innerHTML = options;
      taskProjSelect.value = ui.taskProjectFilter;
    }
    if (matProjSelect) {
      matProjSelect.innerHTML = options;
      matProjSelect.value = ui.materialProjectFilter;
    }
    if (workerSpecSelect) {
      const trades = Array.from(new Set(state.workers.map((w) => w.trade))).sort();
      workerSpecSelect.innerHTML =
        '<option value="ALL">All Trade Specialties</option>' +
        trades.map((tr) => `<option value="${escapeHtml(tr)}">${escapeHtml(tr)}</option>`).join('');
      workerSpecSelect.value = ui.workerSpecialtyFilter;
    }
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('open');
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('open');
    if (id === 'modal-project-detail') {
      ui.inspectedProjectId = null;
    }
  }

  function populatePhaseSelect(selectEl, projectId, selectedPhaseId) {
    const proj = state.projects.find((p) => p.id === projectId);
    const phases = proj ? proj.phases || [] : [];
    selectEl.innerHTML = phases.length
      ? phases
          .map((ph) => `<option value="${escapeHtml(ph.id)}">${escapeHtml(ph.name)}</option>`)
          .join('')
      : '<option value="">No phases defined</option>';
    if (selectedPhaseId && phases.some((ph) => ph.id === selectedPhaseId)) {
      selectEl.value = selectedPhaseId;
    }
  }

  function openProjectModal(projectId = null) {
    const form = document.getElementById('form-project');
    form.reset();
    document.getElementById('proj-edit-id').value = projectId || '';
    const templateGroup = document.getElementById('proj-template-group');

    if (projectId) {
      const proj = state.projects.find((p) => p.id === projectId);
      if (!proj) return;
      document.getElementById('modal-project-title').textContent = `Edit Project — ${proj.code}`;
      document.getElementById('proj-name').value = proj.name;
      document.getElementById('proj-client').value = proj.client;
      document.getElementById('proj-manager').value = proj.manager;
      document.getElementById('proj-location').value = proj.location;
      document.getElementById('proj-budget').value = proj.budget;
      document.getElementById('proj-start').value = proj.startDate;
      document.getElementById('proj-end').value = proj.endDate;
      document.getElementById('proj-image').value = proj.image;
      document.getElementById('proj-desc').value = proj.description || '';
      templateGroup.style.display = 'none';
    } else {
      document.getElementById('modal-project-title').textContent = 'Create Construction Project';
      document.getElementById('proj-start').value = Data.getTodayDateString();
      document.getElementById('proj-end').value = Data.getOffsetDateString(120);
      templateGroup.style.display = 'flex';
    }
    openModal('modal-project');
  }

  function renderProjectDetailModal(projectId) {
    const proj = state.projects.find((p) => p.id === projectId);
    if (!proj) return;
    ui.inspectedProjectId = projectId;

    const rep = getProjectComputedState(proj, state.referenceDate);
    const projectTasks = state.tasks.filter((t) => t.projectId === proj.id);
    const projectMats = state.materials.filter((m) => m.projectId === proj.id);

    document.getElementById('detail-proj-title').textContent = `${proj.code} — ${proj.name}`;

    const phasesHtml = rep.phaseStates
      .map((ps) => {
        const ph = ps.phase;
        return `
          <div class="phase-row ${ps.status === 'Delayed' ? 'is-delayed' : ''}">
            <div class="phase-row-top">
              <div>
                <strong>${escapeHtml(ph.name)}</strong>
                <span class="mono muted" style="font-size:12px; margin-left:8px;">
                  Due ${escapeHtml(formatShortDate(ph.deadline))}
                </span>
                ${
                  ps.deadlineSlipped
                    ? `<span class="badge badge-critical mono" style="margin-left:6px;">${ps.phaseDeadlineDays}d PAST PHASE DEADLINE</span>`
                    : ''
                }
              </div>
              <div class="action-group">
                ${renderStatusBadge(ps.status)}
                <button type="button" class="btn btn-secondary btn-xs" data-edit-phase="${escapeHtml(proj.id)}|${escapeHtml(ph.id)}">Edit</button>
              </div>
            </div>
            <div class="phase-slider-row">
              <input
                type="range"
                min="0"
                max="100"
                value="${ps.progress}"
                class="range-slider"
                data-phase-slider="${escapeHtml(proj.id)}|${escapeHtml(ph.id)}"
                aria-label="Adjust completion percentage for ${escapeHtml(ph.name)}"
              />
              <span class="mono" data-phase-pct-label="${escapeHtml(ph.id)}" style="min-width:44px; text-align:right; font-weight:700;">${ps.progress}%</span>
              ${
                ps.tasks.length > 0 && ph.manualProgress
                  ? `<button type="button" class="btn btn-ghost btn-xs" data-sync-phase="${escapeHtml(proj.id)}|${escapeHtml(ph.id)}" title="Sync percentage from linked tasks">Sync (${ps.tasks.length} tasks)</button>`
                  : `<span class="muted" style="font-size:11.5px; min-width:86px;">${ps.tasks.length} task(s)</span>`
              }
            </div>
          </div>
        `;
      })
      .join('');

    const tasksHtml = projectTasks.length
      ? projectTasks
          .map((t) => {
            const d = isTaskDelayed(t, state.referenceDate);
            const w = state.workers.find((x) => x.id === t.workerId);
            return `
              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:9px 12px; border:1px solid var(--border-subtle); border-radius:6px; background:${d.delayed ? '#fff8f8' : '#fff'};">
                <div>
                  <div style="font-weight:600; font-size:13px;">${escapeHtml(t.code)}: ${escapeHtml(t.title)}</div>
                  <div class="muted" style="font-size:12px;">${escapeHtml(w ? w.teamName : 'Unassigned')} &middot; Due ${escapeHtml(formatShortDate(t.deadline))}</div>
                </div>
                <div class="action-group">
                  ${d.delayed ? `<span class="badge badge-critical mono">${d.daysOverdue}d LATE</span>` : renderStatusBadge(t.status)}
                  <button type="button" class="btn btn-success-soft btn-xs" data-cycle-task="${escapeHtml(t.id)}">${t.status === 'Completed' ? 'Reopen' : 'Advance'}</button>
                </div>
              </div>
            `;
          })
          .join('')
      : '<p class="muted" style="margin:0;">No tasks assigned to this project yet.</p>';

    const matsHtml = projectMats.length
      ? projectMats
          .map((m) => {
            const d = isMaterialDelayed(m, state.referenceDate);
            return `
              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:9px 12px; border:1px solid var(--border-subtle); border-radius:6px;">
                <div>
                  <div style="font-weight:600; font-size:13px;">${escapeHtml(m.name)}</div>
                  <div class="muted mono" style="font-size:12px;">${m.deliveredQty}/${m.requiredQty} ${escapeHtml(m.unit)} &middot; Due ${escapeHtml(formatShortDate(m.deliveryDeadline))}</div>
                </div>
                <div>
                  ${
                    Number(m.deliveredQty) >= Number(m.requiredQty)
                      ? '<span class="badge badge-completed">Fulfilled</span>'
                      : d.delayed
                      ? `<span class="badge badge-critical mono">DELAYED ${d.daysOverdue}d</span>`
                      : '<span class="badge badge-active">Pending</span>'
                  }
                </div>
              </div>
            `;
          })
          .join('')
      : '<p class="muted" style="margin:0;">No material requirements logged yet.</p>';

    document.getElementById('project-detail-body').innerHTML = `
      <div class="detail-hero">
        <img src="${escapeHtml(proj.image)}" alt="${escapeHtml(proj.name)}" />
        <div class="detail-hero-caption">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <span class="project-code-tag">${escapeHtml(proj.code)} &middot; ${escapeHtml(proj.client)}</span>
            ${renderStatusBadge(rep.status)}
          </div>
          <h3 style="margin:6px 0 2px; font-family:var(--font-display); font-size:20px;">${escapeHtml(proj.name)}</h3>
          <div style="font-size:12.5px; opacity:0.9;">${escapeHtml(proj.location)} &middot; PM: ${escapeHtml(proj.manager)} &middot; Budget: <span class="mono">${formatCompactCurrency(proj.budget)}</span></div>
        </div>
      </div>

      <div style="margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
          <span><strong>Aggregated Project Completion</strong></span>
          <span class="mono"><strong>${rep.overallProgress}%</strong></span>
        </div>
        <div class="progress-track progress-lg">
          <div class="progress-fill ${rep.status === 'Completed' ? 'is-completed' : rep.status === 'Delayed' ? 'is-delayed' : 'is-active'}" style="width:${rep.overallProgress}%;"></div>
        </div>
      </div>

      <div class="detail-section-title">
        <span>Sequential Work Phases (${rep.phaseStates.length})</span>
        <button type="button" class="btn btn-primary btn-xs" data-add-phase="${escapeHtml(proj.id)}">+ Add Work Phase</button>
      </div>
      <div class="phase-pipeline-list">${phasesHtml}</div>

      <div class="detail-section-title">
        <span>Assigned Tasks (${projectTasks.length})</span>
        <button type="button" class="btn btn-secondary btn-xs" data-new-task-for="${escapeHtml(proj.id)}">+ Add Task</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">${tasksHtml}</div>

      <div class="detail-section-title">
        <span>Material Requirements (${projectMats.length})</span>
        <button type="button" class="btn btn-secondary btn-xs" data-new-mat-for="${escapeHtml(proj.id)}">+ Add Material</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">${matsHtml}</div>
    `;

    document.getElementById('project-detail-footer').innerHTML = `
      <button type="button" class="btn btn-danger-soft" data-delete-project="${escapeHtml(proj.id)}" style="margin-right:auto;">Delete Project</button>
      <button type="button" class="btn btn-secondary" data-edit-project="${escapeHtml(proj.id)}">Edit Project Info</button>
      <button type="button" class="btn btn-primary" data-close-modal="modal-project-detail">Done</button>
    `;

    openModal('modal-project-detail');
  }

  function openPhaseModal(projectId, phaseId = null) {
    const form = document.getElementById('form-phase');
    form.reset();
    document.getElementById('phase-proj-id').value = projectId;
    document.getElementById('phase-edit-id').value = phaseId || '';

    const proj = state.projects.find((p) => p.id === projectId);
    if (!proj) return;

    if (phaseId) {
      const ph = (proj.phases || []).find((x) => x.id === phaseId);
      if (!ph) return;
      document.getElementById('modal-phase-title').textContent = 'Edit Work Phase';
      document.getElementById('phase-name').value = ph.name;
      document.getElementById('phase-deadline').value = ph.deadline;
      document.getElementById('phase-progress').value = ph.progress;
    } else {
      document.getElementById('modal-phase-title').textContent = 'Add Work Phase';
      const nextNum = String((proj.phases || []).length + 1).padStart(2, '0');
      document.getElementById('phase-name').value = `${nextNum}. `;
      document.getElementById('phase-deadline').value = Data.getOffsetDateString(30);
      document.getElementById('phase-progress').value = 0;
    }
    openModal('modal-phase');
  }

  function openTaskModal(taskId = null, presetProjectId = null, presetWorkerId = null) {
    if (!state.projects.length) {
      showToast('Create a construction project first before assigning tasks.', 'warning');
      return;
    }
    const form = document.getElementById('form-task');
    form.reset();
    document.getElementById('task-edit-id').value = taskId || '';

    const projSelect = document.getElementById('task-project');
    const phaseSelect = document.getElementById('task-phase');
    const workerSelect = document.getElementById('task-worker');

    projSelect.innerHTML = state.projects
      .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.code)} — ${escapeHtml(p.name)}</option>`)
      .join('');
    workerSelect.innerHTML = state.workers
      .map((w) => `<option value="${escapeHtml(w.id)}">${escapeHtml(w.teamName)} (${escapeHtml(w.leadName)})</option>`)
      .join('');

    if (taskId) {
      const t = state.tasks.find((x) => x.id === taskId);
      if (!t) return;
      document.getElementById('modal-task-title').textContent = `Edit Task — ${t.code}`;
      document.getElementById('task-title').value = t.title;
      projSelect.value = t.projectId;
      populatePhaseSelect(phaseSelect, t.projectId, t.phaseId);
      workerSelect.value = t.workerId;
      document.getElementById('task-deadline').value = t.deadline;
      document.getElementById('task-priority').value = t.priority;
      document.getElementById('task-status').value = t.status;
      document.getElementById('task-desc').value = t.description || '';
    } else {
      document.getElementById('modal-task-title').textContent = 'Assign Construction Task';
      const defaultProjId = presetProjectId || state.projects[0].id;
      projSelect.value = defaultProjId;
      populatePhaseSelect(phaseSelect, defaultProjId);
      if (presetWorkerId) workerSelect.value = presetWorkerId;
      document.getElementById('task-deadline').value = Data.getOffsetDateString(7);
      document.getElementById('task-status').value = 'Pending';
    }

    openModal('modal-task');
  }

  function openWorkerModal(workerId = null) {
    const form = document.getElementById('form-worker');
    form.reset();
    document.getElementById('worker-edit-id').value = workerId || '';

    const projSelect = document.getElementById('worker-project');
    projSelect.innerHTML =
      '<option value="">Shared Resource Pool</option>' +
      state.projects
        .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`)
        .join('');

    if (workerId) {
      const w = state.workers.find((x) => x.id === workerId);
      if (!w) return;
      document.getElementById('modal-worker-title').textContent = `Edit Crew — ${w.code}`;
      document.getElementById('worker-team').value = w.teamName;
      document.getElementById('worker-lead').value = w.leadName;
      document.getElementById('worker-trade').value = w.trade;
      document.getElementById('worker-headcount').value = w.headcount;
      document.getElementById('worker-status').value = w.status;
      document.getElementById('worker-project').value = w.primaryProjectId || '';
      document.getElementById('worker-phone').value = w.phone;
      document.getElementById('worker-cert').value = w.certId || '';
      document.getElementById('worker-rate').value = w.dailyRate || 1400;
    } else {
      document.getElementById('modal-worker-title').textContent = 'Add Worker / Crew Record';
    }
    openModal('modal-worker');
  }

  function openMaterialModal(matId = null, presetProjectId = null) {
    if (!state.projects.length) {
      showToast('Create a project first before adding material requirements.', 'warning');
      return;
    }
    const form = document.getElementById('form-material');
    form.reset();
    document.getElementById('mat-edit-id').value = matId || '';

    const projSelect = document.getElementById('mat-project');
    const phaseSelect = document.getElementById('mat-phase');

    projSelect.innerHTML = state.projects
      .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.code)} — ${escapeHtml(p.name)}</option>`)
      .join('');

    if (matId) {
      const m = state.materials.find((x) => x.id === matId);
      if (!m) return;
      document.getElementById('modal-material-title').textContent = `Edit Material — ${m.code}`;
      document.getElementById('mat-name').value = m.name;
      projSelect.value = m.projectId;
      populatePhaseSelect(phaseSelect, m.projectId, m.phaseId);
      document.getElementById('mat-category').value = m.category;
      document.getElementById('mat-unit').value = m.unit;
      document.getElementById('mat-required').value = m.requiredQty;
      document.getElementById('mat-delivered').value = m.deliveredQty;
      document.getElementById('mat-consumed').value = m.consumedQty || 0;
      document.getElementById('mat-cost').value = m.unitCost || 500;
      document.getElementById('mat-supplier').value = m.supplier;
      document.getElementById('mat-deadline').value = m.deliveryDeadline;
    } else {
      document.getElementById('modal-material-title').textContent = 'Add Material Requirement';
      const defaultProjId = presetProjectId || state.projects[0].id;
      projSelect.value = defaultProjId;
      populatePhaseSelect(phaseSelect, defaultProjId);
      document.getElementById('mat-deadline').value = Data.getOffsetDateString(10);
    }

    openModal('modal-material');
  }

  function buildPresetPhases(preset, startDate, endDate) {
    const totalDays = Math.max(20, diffDays(endDate, startDate));
    const offsetDate = (ratio) => {
      const utc = parseUtcDate(startDate);
      const target = new Date(utc + Math.round(totalDays * ratio) * 86400000);
      return target.toISOString().slice(0, 10);
    };

    if (preset === 'civil') {
      return [
        { id: Data.generateId('ph'), name: '01. Substructure & Foundations', deadline: offsetDate(0.35), progress: 0, status: 'Pending', manualProgress: true },
        { id: Data.generateId('ph'), name: '02. Superstructure & Decking', deadline: offsetDate(0.75), progress: 0, status: 'Pending', manualProgress: true },
        { id: Data.generateId('ph'), name: '03. Testing & Commissioning', deadline: endDate, progress: 0, status: 'Pending', manualProgress: true }
      ];
    }
    if (preset === 'minimal') {
      return [
        { id: Data.generateId('ph'), name: '01. Site Mobilization & Foundation', deadline: offsetDate(0.4), progress: 0, status: 'Pending', manualProgress: true }
      ];
    }
    return [
      { id: Data.generateId('ph'), name: '01. Excavation & Foundation', deadline: offsetDate(0.25), progress: 0, status: 'Pending', manualProgress: true },
      { id: Data.generateId('ph'), name: '02. Structural Framing & Core', deadline: offsetDate(0.55), progress: 0, status: 'Pending', manualProgress: true },
      { id: Data.generateId('ph'), name: '03. MEP & Building Systems', deadline: offsetDate(0.82), progress: 0, status: 'Pending', manualProgress: true },
      { id: Data.generateId('ph'), name: '04. Finishing & Handover', deadline: endDate, progress: 0, status: 'Pending', manualProgress: true }
    ];
  }

  function bindFormHandlers() {

    document.getElementById('form-project').addEventListener('submit', (e) => {
      e.preventDefault();
      const editId = document.getElementById('proj-edit-id').value;
      const name = document.getElementById('proj-name').value.trim();
      const client = document.getElementById('proj-client').value.trim();
      const manager = document.getElementById('proj-manager').value.trim();
      const location = document.getElementById('proj-location').value.trim();
      const budget = Number(document.getElementById('proj-budget').value) || 0;
      const startDate = document.getElementById('proj-start').value;
      const endDate = document.getElementById('proj-end').value;
      const image = document.getElementById('proj-image').value;
      const description = document.getElementById('proj-desc').value.trim();

      if (editId) {
        const proj = state.projects.find((p) => p.id === editId);
        if (proj) {
          Object.assign(proj, { name, client, manager, location, budget, startDate, endDate, image, description });
          showToast(`Updated project "${name}".`, 'success');
        }
      } else {
        const nextNum = 101 + state.projects.length;
        const preset = document.getElementById('proj-phase-preset').value;
        const newProj = {
          id: Data.generateId('proj'),
          code: `PRJ-${nextNum}`,
          name,
          client,
          manager,
          location,
          budget,
          startDate,
          endDate,
          image,
          description,
          phases: buildPresetPhases(preset, startDate, endDate)
        };
        state.projects.unshift(newProj);
        showToast(`Created project "${name}" with ${newProj.phases.length} sequential work phases.`, 'success');
      }

      Data.saveState(state);
      closeModal('modal-project');
      renderAll();
    });

    document.getElementById('form-phase').addEventListener('submit', (e) => {
      e.preventDefault();
      const projId = document.getElementById('phase-proj-id').value;
      const editId = document.getElementById('phase-edit-id').value;
      const name = document.getElementById('phase-name').value.trim();
      const deadline = document.getElementById('phase-deadline').value;
      const progress = Math.max(0, Math.min(100, Number(document.getElementById('phase-progress').value) || 0));

      const proj = state.projects.find((p) => p.id === projId);
      if (!proj) return;

      if (editId) {
        const ph = (proj.phases || []).find((x) => x.id === editId);
        if (ph) {
          ph.name = name;
          ph.deadline = deadline;
          ph.progress = progress;
          ph.manualProgress = true;
          showToast(`Updated phase "${name}".`, 'success');
        }
      } else {
        proj.phases.push({
          id: Data.generateId('ph'),
          name,
          deadline,
          progress,
          status: progress >= 100 ? 'Completed' : progress > 0 ? 'Active' : 'Pending',
          manualProgress: true
        });
        showToast(`Added work phase "${name}".`, 'success');
      }

      Data.saveState(state);
      closeModal('modal-phase');
      renderAll();
    });

    document.getElementById('task-project').addEventListener('change', (e) => {
      populatePhaseSelect(document.getElementById('task-phase'), e.target.value);
    });

    document.getElementById('form-task').addEventListener('submit', (e) => {
      e.preventDefault();
      const editId = document.getElementById('task-edit-id').value;
      const title = document.getElementById('task-title').value.trim();
      const projectId = document.getElementById('task-project').value;
      const phaseId = document.getElementById('task-phase').value;
      const workerId = document.getElementById('task-worker').value;
      const deadline = document.getElementById('task-deadline').value;
      const priority = document.getElementById('task-priority').value;
      const status = document.getElementById('task-status').value;
      const description = document.getElementById('task-desc').value.trim();

      if (editId) {
        const t = state.tasks.find((x) => x.id === editId);
        if (t) {
          const oldProj = t.projectId;
          const oldPhase = t.phaseId;
          Object.assign(t, { title, projectId, phaseId, workerId, deadline, priority, status, description });
          recalculatePhaseProgressFromTasks(oldProj, oldPhase);
          recalculatePhaseProgressFromTasks(projectId, phaseId);
          showToast(`Updated task "${title}".`, 'success');
        }
      } else {
        const nextNum = 101 + state.tasks.length;
        state.tasks.unshift({
          id: Data.generateId('tsk'),
          code: `TSK-${nextNum}`,
          projectId,
          phaseId,
          workerId,
          title,
          description,
          priority,
          status,
          deadline,
          estimatedHours: 40
        });
        recalculatePhaseProgressFromTasks(projectId, phaseId);
        showToast(`Assigned task "${title}".`, 'success');
      }

      Data.saveState(state);
      closeModal('modal-task');
      renderAll();
    });

    document.getElementById('form-worker').addEventListener('submit', (e) => {
      e.preventDefault();
      const editId = document.getElementById('worker-edit-id').value;
      const teamName = document.getElementById('worker-team').value.trim();
      const leadName = document.getElementById('worker-lead').value.trim();
      const trade = document.getElementById('worker-trade').value;
      const headcount = Math.max(1, Number(document.getElementById('worker-headcount').value) || 1);
      const status = document.getElementById('worker-status').value;
      const primaryProjectId = document.getElementById('worker-project').value;
      const phone = document.getElementById('worker-phone').value.trim();
      const certId = document.getElementById('worker-cert').value.trim();
      const dailyRate = Number(document.getElementById('worker-rate').value) || 1400;

      if (editId) {
        const w = state.workers.find((x) => x.id === editId);
        if (w) {
          Object.assign(w, { teamName, leadName, trade, headcount, status, primaryProjectId, phone, certId, dailyRate });
          showToast(`Updated crew "${teamName}".`, 'success');
        }
      } else {
        const code = `CRW-${String(state.workers.length + 1).padStart(2, '0')}`;
        state.workers.push({
          id: Data.generateId('wrk'),
          code,
          teamName,
          leadName,
          trade,
          headcount,
          status,
          primaryProjectId,
          phone,
          certId,
          dailyRate
        });
        showToast(`Added crew "${teamName}".`, 'success');
      }

      Data.saveState(state);
      closeModal('modal-worker');
      renderAll();
    });

    document.getElementById('mat-project').addEventListener('change', (e) => {
      populatePhaseSelect(document.getElementById('mat-phase'), e.target.value);
    });

    document.getElementById('form-material').addEventListener('submit', (e) => {
      e.preventDefault();
      const editId = document.getElementById('mat-edit-id').value;
      const name = document.getElementById('mat-name').value.trim();
      const projectId = document.getElementById('mat-project').value;
      const phaseId = document.getElementById('mat-phase').value;
      const category = document.getElementById('mat-category').value;
      const unit = document.getElementById('mat-unit').value.trim();
      const requiredQty = Math.max(1, Number(document.getElementById('mat-required').value) || 1);
      const deliveredQty = Math.max(0, Number(document.getElementById('mat-delivered').value) || 0);
      const consumedQty = Math.max(0, Number(document.getElementById('mat-consumed').value) || 0);
      const unitCost = Math.max(1, Number(document.getElementById('mat-cost').value) || 100);
      const supplier = document.getElementById('mat-supplier').value.trim();
      const deliveryDeadline = document.getElementById('mat-deadline').value;

      if (editId) {
        const m = state.materials.find((x) => x.id === editId);
        if (m) {
          Object.assign(m, {
            name,
            projectId,
            phaseId,
            category,
            unit,
            requiredQty,
            deliveredQty,
            consumedQty,
            unitCost,
            supplier,
            deliveryDeadline
          });
          showToast(`Updated material "${name}".`, 'success');
        }
      } else {
        const code = `MAT-${String(state.materials.length + 1).padStart(2, '0')}`;
        state.materials.unshift({
          id: Data.generateId('mat'),
          code,
          projectId,
          phaseId,
          name,
          category,
          unit,
          requiredQty,
          deliveredQty,
          consumedQty,
          unitCost,
          supplier,
          deliveryDeadline
        });
        showToast(`Logged material requirement "${name}".`, 'success');
      }

      Data.saveState(state);
      closeModal('modal-material');
      renderAll();
    });
  }

  function bindUiEvents() {

    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    document.getElementById('btn-mobile-menu').addEventListener('click', () => {
      document.getElementById('sidebar').classList.add('open');
      document.getElementById('sidebar-backdrop').classList.add('open');
    });
    document.getElementById('sidebar-backdrop').addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebar-backdrop').classList.remove('open');
    });

    document.getElementById('global-search').addEventListener('input', (e) => {
      ui.searchQuery = e.target.value;
      renderCurrentView();
    });

    document.getElementById('ref-date-input').addEventListener('change', (e) => {
      if (!e.target.value) return;
      state.referenceDate = e.target.value;
      Data.saveState(state);
      renderAll();
      showToast(`Delay engine evaluated against ${formatShortDate(state.referenceDate)}.`, 'info');
    });

    document.getElementById('btn-today-date').addEventListener('click', () => {
      state.referenceDate = Data.getTodayDateString();
      Data.saveState(state);
      renderAll();
      showToast('Reference date reset to Today.', 'info');
    });

    document.getElementById('btn-reset-demo').addEventListener('click', () => {
      state = Data.resetState();
      ui.searchQuery = '';
      ui.spotlightProjectId = null;
      ui.delayTriageFilter = 'ALL';
      ui.selectedPhaseByProject = {};
      ui.delayRadarFilter = 'ALL';
      ui.workerSpecialtyFilter = 'ALL';
      document.getElementById('global-search').value = '';
      renderAll();
      showToast('Demo construction dataset restored.', 'success');
    });

    document.getElementById('btn-quick-project').addEventListener('click', () => openProjectModal());
    document.getElementById('btn-create-project-view').addEventListener('click', () => openProjectModal());
    document.getElementById('btn-quick-task').addEventListener('click', () => openTaskModal());
    document.getElementById('btn-create-task-view').addEventListener('click', () => openTaskModal());
    document.getElementById('btn-create-worker-view').addEventListener('click', () => openWorkerModal());
    document.getElementById('btn-create-material-view').addEventListener('click', () => openMaterialModal());

    document.getElementById('project-filter-pills').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-proj-filter]');
      if (!btn) return;
      ui.projectFilter = btn.dataset.projFilter;
      document.querySelectorAll('[data-proj-filter]').forEach((b) => b.classList.toggle('active', b === btn));
      renderProjectsView(getPortalAnalytics());
    });

    document.getElementById('task-status-pills').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-task-filter]');
      if (!btn) return;
      ui.taskStatusFilter = btn.dataset.taskFilter;
      document.querySelectorAll('[data-task-filter]').forEach((b) => b.classList.toggle('active', b === btn));
      renderTasksView(getPortalAnalytics());
    });

    document.getElementById('task-view-switcher').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-task-view-mode]');
      if (!btn) return;
      ui.taskViewMode = btn.dataset.taskViewMode;
      renderTasksView(getPortalAnalytics());
    });

    document.getElementById('delay-triage-tabs').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-triage-tab]');
      if (!btn) return;
      ui.delayTriageFilter = btn.dataset.triageTab;
      renderDashboard(getPortalAnalytics());
    });

    document.getElementById('delay-type-pills').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-delay-filter]');
      if (!btn) return;
      ui.delayRadarFilter = btn.dataset.delayFilter;
      renderDelayRadarView(getPortalAnalytics());
    });

    document.getElementById('delay-view-switcher').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-delay-view-mode]');
      if (!btn) return;
      ui.delayViewMode = btn.dataset.delayViewMode;
      renderDelayRadarView(getPortalAnalytics());
    });

    document.getElementById('task-project-filter').addEventListener('change', (e) => {
      ui.taskProjectFilter = e.target.value;
      renderTasksView(getPortalAnalytics());
    });

    document.getElementById('worker-trade-pills').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-worker-filter]');
      if (!btn) return;
      ui.workerFilter = btn.dataset.workerFilter;
      document.querySelectorAll('[data-worker-filter]').forEach((b) => b.classList.toggle('active', b === btn));
      renderWorkersView(getPortalAnalytics());
    });

    document.getElementById('worker-specialty-filter').addEventListener('change', (e) => {
      ui.workerSpecialtyFilter = e.target.value;
      renderWorkersView(getPortalAnalytics());
    });

    document.getElementById('material-filter-pills').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mat-filter]');
      if (!btn) return;
      ui.materialFilter = btn.dataset.matFilter;
      document.querySelectorAll('[data-mat-filter]').forEach((b) => b.classList.toggle('active', b === btn));
      renderMaterialsView(getPortalAnalytics());
    });

    document.getElementById('material-view-switcher').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mat-view-mode]');
      if (!btn) return;
      ui.materialViewMode = btn.dataset.matViewMode;
      renderMaterialsView(getPortalAnalytics());
    });

    document.getElementById('material-project-filter').addEventListener('change', (e) => {
      ui.materialProjectFilter = e.target.value;
      renderMaterialsView(getPortalAnalytics());
    });

    document.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('[data-close-modal]');
      if (closeBtn) {
        closeModal(closeBtn.dataset.closeModal);
        return;
      }
      if (e.target.classList.contains('modal-backdrop')) {
        closeModal(e.target.id);
        return;
      }

      const spotBtn = e.target.closest('[data-spotlight-proj]');
      if (spotBtn) {
        ui.spotlightProjectId = spotBtn.dataset.spotlightProj;
        renderDashboard(getPortalAnalytics());
        return;
      }

      const selectCardPhaseBtn = e.target.closest('[data-select-card-phase]');
      if (selectCardPhaseBtn) {
        const [projId, phaseId] = selectCardPhaseBtn.dataset.selectCardPhase.split('|');
        ui.selectedPhaseByProject[projId] = phaseId;
        renderProjectsView(getPortalAnalytics());
        return;
      }

      const quickTaskFilterBtn = e.target.closest('[data-quick-task-filter]');
      if (quickTaskFilterBtn) {
        ui.taskStatusFilter = quickTaskFilterBtn.dataset.quickTaskFilter;
        document.querySelectorAll('[data-task-filter]').forEach((b) => {
          b.classList.toggle('active', b.dataset.taskFilter === ui.taskStatusFilter);
        });
        renderTasksView(getPortalAnalytics());
        return;
      }

      const bumpBtn = e.target.closest('[data-bump-phase]');
      if (bumpBtn) {
        const [projId, phaseId] = bumpBtn.dataset.bumpPhase.split('|');
        const proj = state.projects.find((p) => p.id === projId);
        const ph = proj ? (proj.phases || []).find((x) => x.id === phaseId) : null;
        if (proj && ph) {
          const ps = getPhaseComputedState(
            ph,
            state.tasks.filter((t) => t.projectId === projId),
            state.referenceDate
          );
          if (ps.progress >= 100) {
            renderProjectDetailModal(projId);
          } else {
            ph.progress = Math.min(100, ps.progress + 25);
            ph.manualProgress = true;
            Data.saveState(state);
            renderAll();
            showToast(`${ph.name} updated to ${ph.progress}% completion.`, 'success');
          }
        }
        return;
      }

      const shiftBtn = e.target.closest('[data-shift-days]');
      if (shiftBtn) {
        const delta = Number(shiftBtn.dataset.shiftDays);
        if (delta === 0) {
          state.referenceDate = Data.getTodayDateString();
          Data.saveState(state);
          renderAll();
          showToast('Reference date reset to Today.', 'info');
        } else {
          shiftReferenceDate(delta);
        }
        return;
      }

      const legendBtn = e.target.closest('[data-legend-task-filter]');
      if (legendBtn) {
        ui.taskStatusFilter = legendBtn.dataset.legendTaskFilter;
        document.querySelectorAll('[data-task-filter]').forEach((b) => {
          b.classList.toggle('active', b.dataset.taskFilter === ui.taskStatusFilter);
        });
        switchView('tasks');
        return;
      }

      const kpiBtn = e.target.closest('[data-kpi-nav]');
      if (kpiBtn) {
        const [targetView, filterVal] = kpiBtn.dataset.kpiNav.split(':');
        if (targetView === 'projects') {
          ui.projectFilter = filterVal;
          document.querySelectorAll('[data-proj-filter]').forEach((b) => {
            b.classList.toggle('active', b.dataset.projFilter === filterVal);
          });
        }
        switchView(targetView);
        return;
      }

      const gotoBtn = e.target.closest('[data-goto-view]');
      if (gotoBtn) {
        switchView(gotoBtn.dataset.gotoView);
        return;
      }

      const openProjBtn = e.target.closest('[data-open-project]');
      if (openProjBtn) {
        renderProjectDetailModal(openProjBtn.dataset.openProject);
        return;
      }

      const editProjBtn = e.target.closest('[data-edit-project]');
      if (editProjBtn) {
        openProjectModal(editProjBtn.dataset.editProject);
        return;
      }
      const delProjBtn = e.target.closest('[data-delete-project]');
      if (delProjBtn) {
        const pid = delProjBtn.dataset.deleteProject;
        state.projects = state.projects.filter((p) => p.id !== pid);
        state.tasks = state.tasks.filter((t) => t.projectId !== pid);
        state.materials = state.materials.filter((m) => m.projectId !== pid);
        Data.saveState(state);
        closeModal('modal-project-detail');
        renderAll();
        showToast('Project and linked activities deleted.', 'warning');
        return;
      }

      const addPhaseBtn = e.target.closest('[data-add-phase]');
      if (addPhaseBtn) {
        openPhaseModal(addPhaseBtn.dataset.addPhase);
        return;
      }
      const editPhaseBtn = e.target.closest('[data-edit-phase]');
      if (editPhaseBtn) {
        const [projId, phaseId] = editPhaseBtn.dataset.editPhase.split('|');
        openPhaseModal(projId, phaseId);
        return;
      }
      const syncPhaseBtn = e.target.closest('[data-sync-phase]');
      if (syncPhaseBtn) {
        const [projId, phaseId] = syncPhaseBtn.dataset.syncPhase.split('|');
        recalculatePhaseProgressFromTasks(projId, phaseId);
        Data.saveState(state);
        renderAll();
        showToast('Phase progress synced from linked tasks.', 'success');
        return;
      }

      const newTaskForBtn = e.target.closest('[data-new-task-for]');
      if (newTaskForBtn) {
        openTaskModal(null, newTaskForBtn.dataset.newTaskFor);
        return;
      }
      const editTaskBtn = e.target.closest('[data-edit-task]');
      if (editTaskBtn) {
        openTaskModal(editTaskBtn.dataset.editTask);
        return;
      }
      const cycleTaskBtn = e.target.closest('[data-cycle-task]');
      if (cycleTaskBtn) {
        const t = state.tasks.find((x) => x.id === cycleTaskBtn.dataset.cycleTask);
        if (t) {
          t.status =
            t.status === 'Pending'
              ? 'In Progress'
              : t.status === 'In Progress'
              ? 'Completed'
              : 'Pending';
          recalculatePhaseProgressFromTasks(t.projectId, t.phaseId);
          Data.saveState(state);
          renderAll();
          showToast(`Task ${t.code} moved to ${t.status}.`, 'success');
        }
        return;
      }
      const completeTaskBtn = e.target.closest('[data-complete-task]');
      if (completeTaskBtn) {
        const t = state.tasks.find((x) => x.id === completeTaskBtn.dataset.completeTask);
        if (t) {
          t.status = 'Completed';
          recalculatePhaseProgressFromTasks(t.projectId, t.phaseId);
          Data.saveState(state);
          renderAll();
          showToast(`Task ${t.code} marked Completed — delay cleared!`, 'success');
        }
        return;
      }
      const extendTaskBtn = e.target.closest('[data-extend-task]');
      if (extendTaskBtn) {
        const t = state.tasks.find((x) => x.id === extendTaskBtn.dataset.extendTask);
        if (t) {
          const baseUtc = Math.max(parseUtcDate(state.referenceDate), parseUtcDate(t.deadline || state.referenceDate));
          t.deadline = new Date(baseUtc + 5 * 86400000).toISOString().slice(0, 10);
          Data.saveState(state);
          renderAll();
          showToast(`Task ${t.code} rescheduled to ${formatShortDate(t.deadline)}.`, 'info');
        }
        return;
      }
      const delTaskBtn = e.target.closest('[data-delete-task]');
      if (delTaskBtn) {
        const tid = delTaskBtn.dataset.deleteTask;
        const target = state.tasks.find((x) => x.id === tid);
        state.tasks = state.tasks.filter((x) => x.id !== tid);
        if (target) recalculatePhaseProgressFromTasks(target.projectId, target.phaseId);
        Data.saveState(state);
        renderAll();
        showToast('Task removed.', 'warning');
        return;
      }

      const assignWorkerTaskBtn = e.target.closest('[data-assign-worker-task]');
      if (assignWorkerTaskBtn) {
        const w = state.workers.find((x) => x.id === assignWorkerTaskBtn.dataset.assignWorkerTask);
        openTaskModal(null, w && w.primaryProjectId ? w.primaryProjectId : null, w ? w.id : null);
        return;
      }
      const editWorkerBtn = e.target.closest('[data-edit-worker]');
      if (editWorkerBtn) {
        openWorkerModal(editWorkerBtn.dataset.editWorker);
        return;
      }
      const cycleWorkerBtn = e.target.closest('[data-cycle-worker]');
      if (cycleWorkerBtn) {
        const w = state.workers.find((x) => x.id === cycleWorkerBtn.dataset.cycleWorker);
        if (w) {
          w.status = w.status === 'On Site' ? 'Assigned' : w.status === 'Assigned' ? 'Standby' : 'On Site';
          Data.saveState(state);
          renderAll();
          showToast(`${w.teamName} status set to ${w.status}.`, 'info');
        }
        return;
      }
      const delWorkerBtn = e.target.closest('[data-delete-worker]');
      if (delWorkerBtn) {
        const wid = delWorkerBtn.dataset.deleteWorker;
        state.workers = state.workers.filter((w) => w.id !== wid);
        Data.saveState(state);
        renderAll();
        showToast('Crew record deleted.', 'warning');
        return;
      }

      const newMatForBtn = e.target.closest('[data-new-mat-for]');
      if (newMatForBtn) {
        openMaterialModal(null, newMatForBtn.dataset.newMatFor);
        return;
      }
      const editMatBtn = e.target.closest('[data-edit-material]');
      if (editMatBtn) {
        openMaterialModal(editMatBtn.dataset.editMaterial);
        return;
      }
      const receiveFullBtn = e.target.closest('[data-receive-material]');
      if (receiveFullBtn) {
        const m = state.materials.find((x) => x.id === receiveFullBtn.dataset.receiveMaterial);
        if (m) {
          m.deliveredQty = m.requiredQty;
          Data.saveState(state);
          renderAll();
          showToast(`Received full stock for ${m.name}.`, 'success');
        }
        return;
      }
      const receiveBatchBtn = e.target.closest('[data-receive-batch]');
      if (receiveBatchBtn) {
        const m = state.materials.find((x) => x.id === receiveBatchBtn.dataset.receiveBatch);
        if (m) {
          const step = Math.max(1, Math.ceil((Number(m.requiredQty) - Number(m.deliveredQty)) / 2));
          m.deliveredQty = Math.min(Number(m.requiredQty), Number(m.deliveredQty) + step);
          Data.saveState(state);
          renderAll();
          showToast(`Logged delivery batch (${m.deliveredQty}/${m.requiredQty} ${m.unit}).`, 'success');
        }
        return;
      }
      const consumeMatBtn = e.target.closest('[data-consume-material]');
      if (consumeMatBtn) {
        const m = state.materials.find((x) => x.id === consumeMatBtn.dataset.consumeMaterial);
        if (m) {
          const del = Number(m.deliveredQty) || 0;
          const cur = Number(m.consumedQty) || 0;
          const step = Math.max(1, Math.ceil(del * 0.1));
          m.consumedQty = Math.min(del, cur + step);
          Data.saveState(state);
          renderAll();
          showToast(`Logged site usage (${m.consumedQty}/${del} ${m.unit} delivered).`, 'info');
        }
        return;
      }
      const delMatBtn = e.target.closest('[data-delete-material]');
      if (delMatBtn) {
        state.materials = state.materials.filter((m) => m.id !== delMatBtn.dataset.deleteMaterial);
        Data.saveState(state);
        renderAll();
        showToast('Material item removed.', 'warning');
      }
    });

    document.addEventListener('input', (e) => {
      const slider = e.target.closest('[data-phase-slider]');
      if (!slider) return;
      const [projId, phaseId] = slider.dataset.phaseSlider.split('|');
      const proj = state.projects.find((p) => p.id === projId);
      const ph = proj ? (proj.phases || []).find((x) => x.id === phaseId) : null;
      if (ph) {
        ph.progress = Number(slider.value);
        ph.manualProgress = true;
        document.querySelectorAll(`[data-phase-pct-label="${phaseId}"]`).forEach((el) => {
          el.textContent = `${ph.progress}%`;
        });
      }
    });

    document.addEventListener('change', (e) => {
      const slider = e.target.closest('[data-phase-slider]');
      if (!slider) return;
      Data.saveState(state);
      renderAll();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.open').forEach((m) => closeModal(m.id));
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindFormHandlers();
    bindUiEvents();
    renderAll();
  });
})();
