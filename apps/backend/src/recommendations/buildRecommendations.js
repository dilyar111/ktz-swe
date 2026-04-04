'use strict';

/**
 * HK-015 — Normalized operator recommendations (alert + health + scenario).
 * Sorted critical-first; deduplicated by logical key. Not LLM-generated.
 */

const SEVERITY_RANK = { critical: 3, warning: 2, info: 1 };

/** Action-oriented titles — must not copy alert `title` strings verbatim. */
const ALERT_ACTION_TITLE = {
  OVERHEATING: {
    critical: 'Снизьте тепловую нагрузку и стабилизируйте охлаждение',
    warning: 'Смените режим работы до стабилизации температуры',
  },
  BRAKE_PRESSURE_DROP: {
    critical: 'Восстановите безопасный ресурс тормозной магистрали',
    warning: 'Проверьте герметичность контура и работу компрессора',
  },
  OVERSPEED: {
    critical: 'Немедленно вернитесь в допустимый коридор скорости',
    warning: 'Заранее снизьте ход относительно ограничения',
  },
  CURRENT_ANOMALY: {
    critical: 'Сбросьте избыточную электрическую нагрузку привода',
    warning: 'Проверьте стабильность цепи тяги и достоверность датчиков',
  },
  SIGNAL_DEGRADATION: {
    critical: 'Обеспечьте приемлемое качество канала связи и обновлений кабины',
    warning: 'Усильте контроль радиоканала и помех; планируйте проверку СЦБ',
  },
  FAULT_CODE_ESCALATION: {
    critical: 'Разберите приоритетные коды неисправностей по диагностике',
    warning: 'Зафиксируйте условия появления кодов и проверьте блокировки',
  },
};

/**
 * @param {{ code?: string, severity?: string, subsystem?: string }} alert
 */
function actionTitleForAlert(alert) {
  const byCode = ALERT_ACTION_TITLE[alert.code];
  if (byCode) {
    const sev = alert.severity === 'critical' || alert.severity === 'warning' ? alert.severity : 'warning';
    if (byCode[sev]) return byCode[sev];
    return byCode.warning || byCode.critical;
  }
  const sub = alert.subsystem || 'подсистема';
  return `Корректирующие действия: ${sub}`;
}

/**
 * @param {unknown[]} alerts
 */
function fromAlerts(alerts) {
  if (!Array.isArray(alerts)) return [];
  return alerts.map((a) => {
    const rec =
      typeof a.recommendation === 'string' && a.recommendation.trim()
        ? a.recommendation
        : typeof a.message === 'string'
          ? a.message
          : '';
    return {
      severity: a.severity === 'critical' || a.severity === 'warning' || a.severity === 'info' ? a.severity : 'info',
      title: actionTitleForAlert(a),
      message: rec,
      source: /** @type {'alert'} */ ('alert'),
      subsystem: typeof a.subsystem === 'string' && a.subsystem ? a.subsystem : 'general',
      _dedupe: `alert:${a.code || 'unknown'}`,
    };
  });
}

/**
 * @param {{ name?: string, reason?: string }} c
 * @param {string} subsystem
 */
function healthMessageForContributor(c, subsystem) {
  const name = String(c.name || '').toLowerCase();
  const reason = String(c.reason || '');

  if (name.includes('overheat') || reason.toLowerCase().includes('overheat')) {
    return 'Снизьте нагрузку, проверьте контур охлаждения и уровень ОЖ; отслеживайте тренд до выхода в безопасный коридор.';
  }
  if (name.includes('brake') && name.includes('pressure')) {
    return 'Проверьте магистраль, изоляционные краны, конденсат и цикл компрессора; не наращивайте скорость без нормализации давления.';
  }
  if (name.includes('signal') || name.includes('quality')) {
    return 'Проверьте антенный тракт, устойчивость канала и резервные процедуры; держите запас по скорости при нестабильной связи.';
  }
  if (name.includes('fault')) {
    return 'Считайте коды с диагностического терминала, зафиксируйте межтактные изменения и снимайте блокировки по регламенту.';
  }
  if (subsystem === 'traction') {
    return 'Согласуйте скорость и тягу с ограничениями участка; избегайте рывков нагрузки.';
  }
  if (subsystem === 'electrical') {
    return 'Проверьте цепи тяги, контакт токоприёмника и журнал событий инвертора/ВИП.';
  }
  return reason || `Сфокусируйтесь на восстановлении показателей подсистемы «${subsystem}».`;
}

/**
 * @param {string} subsystem
 * @param {{ name?: string }} c
 * @param {'critical' | 'warning'} severity
 */
function healthTitleFor(subsystem, c, severity) {
  const name = String(c.name || '').toLowerCase();
  if (subsystem === 'thermal') {
    return severity === 'critical' ? 'Приоритет: тепловой баланс' : 'Стабилизируйте тепловой режим';
  }
  if (subsystem === 'brakes') return 'Приведите тормозной ресурс в порядок';
  if (subsystem === 'signaling') return 'Укрепите достоверность сигнализации и связи';
  if (subsystem === 'traction') return 'Согласуйте ход с безопасным режимом';
  if (subsystem === 'electrical') return 'Нормализуйте электрический режим тяги';
  if (name.includes('fault')) return 'Обработайте диагностические коды';
  return `Действия по подсистеме «${subsystem}»`;
}

/**
 * @param {Record<string, unknown>} health
 * @param {Set<string>} subsystemsWithAlerts
 */
function fromHealth(health, subsystemsWithAlerts) {
  const subsystems = health && typeof health.subsystems === 'object' && health.subsystems ? health.subsystems : null;
  if (!subsystems) return [];

  /** @type {Array<object>} */
  const out = [];
  for (const [key, sub] of Object.entries(subsystems)) {
    if (!sub || typeof sub !== 'object') continue;
    if (sub.status === 'normal') continue;
    if (subsystemsWithAlerts.has(key)) continue;
    const contributors = Array.isArray(sub.contributors) ? sub.contributors : [];
    const c = contributors[0];
    if (!c || typeof c !== 'object') continue;
    const severity = sub.status === 'critical' ? 'critical' : 'warning';
    out.push({
      severity,
      title: healthTitleFor(key, c, severity),
      message: healthMessageForContributor(c, key),
      source: /** @type {'health'} */ ('health'),
      subsystem: key,
      _dedupe: `health:${key}`,
    });
  }
  return out;
}

/**
 * @param {Record<string, unknown>} snapshot
 * @param {Set<string>} alertSubsystems — skip scenario blurb if alerts already cover that subsystem
 */
function fromScenario(snapshot, alertSubsystems) {
  const raw =
    snapshot.demoScenario != null
      ? String(snapshot.demoScenario).toLowerCase().trim()
      : '';
  if (!raw || raw === 'normal') return [];

  /** @type {Set<string>} */
  const skip = alertSubsystems instanceof Set ? alertSubsystems : new Set();

  /** @type {Array<{ severity: string, title: string, message: string, source: 'scenario', subsystem: string, _dedupe: string }>} */
  const rows = [];

  if (raw === 'brake_drop') {
    if (skip.has('brakes')) return [];
    rows.push({
      severity: 'info',
      title: 'Контекст учебного сценария: тормозная магистраль',
      message:
        'Сценарий имитирует просадку давления. Отработайте поиск утечек, состояние УР и готовность компрессора до возобновления движения.',
      source: 'scenario',
      subsystem: 'brakes',
      _dedupe: 'scenario:brake_drop',
    });
  } else if (raw === 'signal_loss') {
    if (skip.has('signaling')) return [];
    rows.push({
      severity: 'info',
      title: 'Контекст учебного сценария: деградация канала',
      message:
        'Сценарий воспроизводит потерю качества связи и рост диагностических кодов. Держите запас по скорости и следуйте локальным процедурам при задержке обновлений.',
      source: 'scenario',
      subsystem: 'signaling',
      _dedupe: 'scenario:signal_loss',
    });
  } else if (raw === 'critical') {
    if (skip.has('thermal')) return [];
    rows.push({
      severity: 'info',
      title: 'Контекст учебного сценария: перегрев',
      message:
        'Сценарий разгоняет тепловой режим. Последовательно снижайте тягу, контролируйте охлаждение и не допускайте дальнейшего роста температуры без осмотра.',
      source: 'scenario',
      subsystem: 'thermal',
      _dedupe: 'scenario:critical',
    });
  } else if (raw === 'highload') {
    if (skip.has('traction') || skip.has('electrical')) return [];
    rows.push({
      severity: 'info',
      title: 'Контекст учебного сценария: предельная нагрузка',
      message:
        'Сценарий нагружает тягу и механику. Снизьте скорость и нагрузку, проверьте вибрацию и допустимость тока для профиля локомотива.',
      source: 'scenario',
      subsystem: 'traction',
      _dedupe: 'scenario:highload',
    });
  }

  return rows;
}

/**
 * @param {Record<string, unknown>} snapshot
 * @param {Record<string, unknown>} health
 * @param {unknown[]} alerts
 * @returns {Array<{ severity: string, title: string, message: string, source: string, subsystem: string }>}
 */
function buildRecommendations(snapshot, health, alerts) {
  const alertRows = fromAlerts(alerts);
  const subsystemsWithAlerts = new Set(
    alertRows.map((r) => r.subsystem).filter((s) => s && s !== 'general')
  );
  const healthRows = fromHealth(health, subsystemsWithAlerts);
  const scenarioRows = fromScenario(snapshot, subsystemsWithAlerts);

  const combined = [...alertRows, ...healthRows, ...scenarioRows];
  combined.sort((a, b) => {
    const dr = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (dr !== 0) return dr;
    const src = { alert: 0, health: 1, scenario: 2 };
    return (src[a.source] ?? 9) - (src[b.source] ?? 9);
  });

  const seen = new Set();
  /** @type {Array<{ severity: string, title: string, message: string, source: string, subsystem: string }>} */
  const out = [];
  for (const row of combined) {
    const key = row._dedupe;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    const { _dedupe, ...rest } = row;
    if (!rest.message || !String(rest.message).trim()) continue;
    out.push(rest);
  }
  return out;
}

module.exports = {
  buildRecommendations,
};
