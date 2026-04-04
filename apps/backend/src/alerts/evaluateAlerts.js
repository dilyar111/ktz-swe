'use strict';

const { randomUUID } = require('crypto');
const { normalizeTelemetry } = require('../health/normalize');

/**
 * @typedef {'info' | 'warning' | 'critical'} AlertSeverity
 */

/**
 * @typedef {object} Alert
 * @property {string} id
 * @property {AlertSeverity} severity
 * @property {string} subsystem
 * @property {string} code
 * @property {string} title
 * @property {string} message
 * @property {string} recommendation
 * @property {string} timestamp
 * @property {string} locomotiveType
 */

/**
 * @typedef {object} TelemetryPrevState
 * @property {number} [brake_pressure]
 * @property {number} [current]
 * @property {number} [fault_count]
 */

/**
 * @param {Omit<Alert, 'id'> & { id?: string }} fields
 * @returns {Alert}
 */
function makeAlert(fields) {
  return {
    id: fields.id ?? randomUUID(),
    severity: fields.severity,
    subsystem: fields.subsystem,
    code: fields.code,
    title: fields.title,
    message: fields.message,
    recommendation: fields.recommendation,
    timestamp: fields.timestamp,
    locomotiveType: fields.locomotiveType,
  };
}

const SEVERITY_RANK = { critical: 3, warning: 2, info: 1 };

/**
 * @param {Alert[]} alerts
 * @returns {Alert[]}
 */
function sortAlerts(alerts) {
  return [...alerts].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.code.localeCompare(b.code)
  );
}

/** Один алерт на code за такт — оставляем наиболее суровый. */
function dedupeByCode(alerts) {
  const map = new Map();
  for (const a of alerts) {
    const ex = map.get(a.code);
    if (!ex || SEVERITY_RANK[a.severity] > SEVERITY_RANK[ex.severity]) map.set(a.code, a);
  }
  return sortAlerts([...map.values()]);
}

/**
 * Правила алертов: перегрев, падение давления тормозов, превышение скорости,
 * аномалия тока, деградация сигнала, эскалация кодов неисправностей.
 *
 * @param {Record<string, unknown>} snapshot
 * @param {TelemetryPrevState | null | undefined} prev
 * @returns {{ alerts: Alert[], nextState: TelemetryPrevState }}
 */
function evaluateAlerts(snapshot, prev) {
  const input = normalizeTelemetry(snapshot);
  const locomotiveType = input.locomotiveType;
  const ts =
    typeof snapshot.timestamp === 'string' && snapshot.timestamp
      ? snapshot.timestamp
      : new Date().toISOString();

  /** @type {Alert[]} */
  const alerts = [];

  const temp = input.engine_temp;
  if (Number.isFinite(temp)) {
    if (temp > 100) {
      alerts.push(
        makeAlert({
          severity: 'critical',
          subsystem: 'thermal',
          code: 'OVERHEATING',
          title: 'Критический перегрев',
          message: `Температура двигателя ${temp.toFixed(1)}°C превышает допустимый порог (>100°C).`,
          recommendation:
            'Снизьте тягу и нагрузку, проверьте контур охлаждения, уровень охлаждающей жидкости и работу вентилятора.',
          timestamp: ts,
          locomotiveType,
        })
      );
    } else if (temp > 90) {
      alerts.push(
        makeAlert({
          severity: 'warning',
          subsystem: 'thermal',
          code: 'OVERHEATING',
          title: 'Повышенная температура',
          message: `Температура двигателя ${temp.toFixed(1)}°C выше штатного диапазона (>90°C).`,
          recommendation:
            'Снизьте нагрузку, наблюдайте за трендом температуры; при росте — подготовьтесь к остановке для осмотра.',
          timestamp: ts,
          locomotiveType,
        })
      );
    }
  }

  const bp = input.brake_pressure;
  if (Number.isFinite(bp)) {
    if (bp < 4.5) {
      alerts.push(
        makeAlert({
          severity: 'critical',
          subsystem: 'brakes',
          code: 'BRAKE_PRESSURE_DROP',
          title: 'Низкое давление в тормозной магистрали',
          message: `Давление ${bp.toFixed(2)} бар ниже безопасного минимума (<4.5 бар).`,
          recommendation:
            'Проверьте плотность тормозной магистрали, состояние компрессора и резервуаров; не начинайте движение без нормализации давления.',
          timestamp: ts,
          locomotiveType,
        })
      );
    } else if (bp >= 4.5 && prev && Number.isFinite(prev.brake_pressure)) {
      const dropBar = prev.brake_pressure - bp;
      if (dropBar >= 0.3) {
        alerts.push(
          makeAlert({
            severity: 'warning',
            subsystem: 'brakes',
            code: 'BRAKE_PRESSURE_DROP',
            title: 'Просадка давления тормозов',
            message: `За такт давление упало на ${dropBar.toFixed(2)} бар (${prev.brake_pressure.toFixed(2)} → ${bp.toFixed(2)}).`,
            recommendation:
            'Проверьте утечки в тормозной системе, клапаны УР и состояние воздухопроводов; при повторении — снизьте скорость и будьте готовы к остановке.',
            timestamp: ts,
            locomotiveType,
          })
        );
      }
    }
  }

  const speed = input.speed;
  const limit = input.speed_limit;
  if (Number.isFinite(speed) && Number.isFinite(limit) && limit > 0) {
    if (speed > limit) {
      alerts.push(
        makeAlert({
          severity: 'critical',
          subsystem: 'traction',
          code: 'OVERSPEED',
          title: 'Превышение скорости',
          message: `Скорость ${speed.toFixed(1)} км/ч выше допустимого ограничения ${limit} км/ч.`,
          recommendation:
            'Немедленно снизьте скорость соблюдением торможения; учитывайте профиль пути и сигнализацию.',
          timestamp: ts,
          locomotiveType,
        })
      );
    } else if (speed > limit * 0.98) {
      alerts.push(
        makeAlert({
          severity: 'warning',
          subsystem: 'traction',
          code: 'OVERSPEED',
          title: 'Приближение к ограничению скорости',
          message: `Скорость ${speed.toFixed(1)} км/ч близка к лимиту ${limit} км/ч.`,
          recommendation: 'Заранее снизьте ход, чтобы удерживать запас до ограничения.',
          timestamp: ts,
          locomotiveType,
        })
      );
    }
  }

  const maxCurrent = locomotiveType === 'TE33A' ? 500 : 650;
  const curr = input.current;
  if (Number.isFinite(curr)) {
    if (curr > maxCurrent) {
      alerts.push(
        makeAlert({
          severity: 'critical',
          subsystem: 'electrical',
          code: 'CURRENT_ANOMALY',
          title: 'Аномально высокий ток тяги',
          message: `Ток ${Math.round(curr)} А превышает допустимый предел для профиля ${locomotiveType}.`,
          recommendation:
            'Снизьте позицию контроллера, проверьте отсутствие заклинивания осей и состояние ВИП/инвертора по диагностике.',
          timestamp: ts,
          locomotiveType,
        })
      );
    } else if (prev && Number.isFinite(prev.current)) {
      const delta = Math.abs(curr - prev.current);
      if (delta > 180) {
        alerts.push(
          makeAlert({
            severity: 'warning',
            subsystem: 'electrical',
            code: 'CURRENT_ANOMALY',
            title: 'Скачок тока тяги',
            message: `Изменение тока за такт ${Math.round(delta)} А (${Math.round(prev.current)} → ${Math.round(curr)}).`,
            recommendation:
              'Проверьте стабильность контакта токоприёмника, отсутствие рывков нагрузки и журнал событий привода.',
            timestamp: ts,
            locomotiveType,
          })
        );
      }
    }
    if (input.speed > 15 && curr < 30 && curr >= 0) {
      alerts.push(
        makeAlert({
          severity: 'warning',
          subsystem: 'electrical',
          code: 'CURRENT_ANOMALY',
          title: 'Несоответствие тока и скорости',
          message: `При скорости ${input.speed.toFixed(1)} км/ч ток тяги аномально низкий (${Math.round(curr)} А).`,
          recommendation:
            'Проверьте цепи управления тягой, снятие блокировок и достоверность датчиков тока.',
          timestamp: ts,
          locomotiveType,
        })
      );
    }
  }

  const sq = input.signal_quality;
  if (Number.isFinite(sq)) {
    if (sq < 70) {
      alerts.push(
        makeAlert({
          severity: 'critical',
          subsystem: 'signaling',
          code: 'SIGNAL_DEGRADATION',
          title: 'Критическое качество сигнала',
          message: `Качество телеметрии/сигнализации ${sq.toFixed(0)}% ниже допустимого порога (<70%).`,
          recommendation:
            'Проверьте антенны, канал связи и шкафы СЦБ; при нестабильности — снизьте скорость до восстановления связи.',
          timestamp: ts,
          locomotiveType,
        })
      );
    } else if (sq < 85) {
      alerts.push(
        makeAlert({
          severity: 'warning',
          subsystem: 'signaling',
          code: 'SIGNAL_DEGRADATION',
          title: 'Снижение качества сигнала',
          message: `Качество канала ${sq.toFixed(0)}% — ниже комфортного запаса (<85%).`,
          recommendation: 'Запланируйте проверку радиоканала и помех; следите за обновлением кабины.',
          timestamp: ts,
          locomotiveType,
        })
      );
    }
  }

  const fc = input.fault_count;
  const prevFc = prev && Number.isFinite(prev.fault_count) ? prev.fault_count : 0;
  if (Number.isFinite(fc) && fc > 0) {
    const escalated = fc > prevFc;
    let severity = /** @type {AlertSeverity} */ ('warning');
    if (fc >= 3) severity = 'critical';
    else if (escalated && prevFc >= 1) severity = 'critical';
    else if (escalated && fc - prevFc >= 2) severity = 'critical';

    const title = escalated ? 'Эскалация кодов неисправностей' : 'Активные коды неисправностей';
    const message = escalated
      ? `Число активных кодов выросло: ${prevFc} → ${fc}.`
      : `Зафиксировано ${fc} активных код(ов) неисправностей на борту.`;

    alerts.push(
      makeAlert({
        severity,
        subsystem: 'signaling',
        code: 'FAULT_CODE_ESCALATION',
        title,
        message,
        recommendation:
          'Подключите диагностический терминал, зафиксируйте коды ECM/TCU, проверьте блокировки и условия сброса; не игнорируйте повторяющиеся коды.',
        timestamp: ts,
        locomotiveType,
      })
    );
  }

  const nextState = {
    brake_pressure: Number.isFinite(bp) ? bp : prev?.brake_pressure,
    current: Number.isFinite(curr) ? curr : prev?.current,
    fault_count: Number.isFinite(fc) ? fc : prev?.fault_count,
  };

  return { alerts: dedupeByCode(alerts), nextState };
}

module.exports = {
  evaluateAlerts,
};
