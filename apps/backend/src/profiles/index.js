const PROFILES = {
  KZ8A: {
    id: "KZ8A",
    name: "KZ8A",
    type: "electric",
    description: "Электрический грузовой локомотив, 25 кВ / 50 Гц",
    subsystems: ["traction", "brakes", "thermal", "electrical", "signaling"],
    fields: [
      { key: "speed",            label: "Скорость",              unit: "км/ч",  subsystem: "traction"   },
      { key: "traction_current", label: "Ток тяговых двигателей",unit: "А",     subsystem: "traction"   },
      { key: "line_voltage",     label: "Напряжение контактной сети", unit: "В", subsystem: "electrical" },
      { key: "brake_pressure",   label: "Давление тормозной магистрали", unit: "кПа", subsystem: "brakes" },
      { key: "main_pressure",    label: "Давление питательной магистрали", unit: "кПа", subsystem: "brakes" },
      { key: "inverter_temp",    label: "Температура инверторов (IGBT)", unit: "°C", subsystem: "thermal" },
      { key: "motor_temp",       label: "Температура обмоток ТД", unit: "°C",   subsystem: "thermal"    },
      { key: "battery_voltage",  label: "Напряжение АКБ",        unit: "В",     subsystem: "electrical" },
      { key: "signal_quality",   label: "Качество сигнала",      unit: "%",     subsystem: "signaling"  },
      { key: "fault_count",      label: "Активных DTC",          unit: "шт",    subsystem: "signaling"  },
    ],
    thresholds: {
      speed:            { warn: 100,  crit: 120  },
      traction_current: { warn: 800,  crit: 1000 },
      line_voltage:     { warnLow: 20000, critLow: 18000 },
      brake_pressure:   { warnLow: 350,   critLow: 300   },
      main_pressure:    { warnLow: 600,   critLow: 500   },
      inverter_temp:    { warn: 80,   crit: 95   },
      motor_temp:       { warn: 120,  crit: 150  },
      battery_voltage:  { warnLow: 48, critLow: 44 },
      signal_quality:   { warnLow: 60, critLow: 30 },
      fault_count:      { warn: 1,    crit: 3    },
    },
    healthWeights: {
      traction:   0.30,
      brakes:     0.25,
      thermal:    0.20,
      electrical: 0.15,
      signaling:  0.10,
    },
    recommendations: {
      inverter_temp_crit:    "Снизить тяговую нагрузку, проверить систему охлаждения инверторов",
      brake_pressure_crit:   "Остановить локомотив, проверить тормозную магистраль",
      line_voltage_crit:     "Проверить токоприёмник и контактную сеть",
      signal_quality_crit:   "Проверить канал связи и антенну КЛУБ-У",
      fault_count_crit:      "Обратиться к журналу DTC, вызвать инженера",
      default:               "Продолжать наблюдение, снизить нагрузку",
    },
  },

  TE33A: {
    id: "TE33A",
    name: "ТЭ33А",
    type: "diesel-electric",
    description: "Дизель-электрический локомотив серии Evolution",
    /** Display order; health engine uses fixed five keys — thermal here maps to diesel/cooling telemetry. */
    subsystems: ["traction", "brakes", "thermal", "electrical", "signaling"],
    fields: [
      { key: "speed",           label: "Скорость",               unit: "км/ч", subsystem: "traction"  },
      { key: "engine_rpm",      label: "Обороты дизеля",         unit: "об/мин", subsystem: "diesel"  },
      { key: "oil_temp",        label: "Температура масла дизеля", unit: "°C",  subsystem: "diesel"   },
      { key: "coolant_temp",    label: "Температура охлаждающей жидкости", unit: "°C", subsystem: "diesel" },
      { key: "fuel_level",      label: "Уровень топлива",        unit: "%",    subsystem: "diesel"    },
      { key: "fuel_consumption",label: "Расход топлива",         unit: "л/ч",  subsystem: "diesel"    },
      { key: "brake_pressure",  label: "Давление тормозной магистрали", unit: "кПа", subsystem: "brakes" },
      { key: "main_pressure",   label: "Давление питательной магистрали", unit: "кПа", subsystem: "brakes" },
      { key: "traction_current",label: "Ток тяговых двигателей", unit: "А",    subsystem: "traction"  },
      { key: "voltage",         label: "Напряжение АКБ/цепей управления", unit: "В", subsystem: "electrical" },
      { key: "signal_quality",  label: "Качество сигнала",       unit: "%",    subsystem: "signaling" },
      { key: "fault_count",     label: "Активных DTC",           unit: "шт",   subsystem: "signaling" },
    ],
    thresholds: {
      speed:            { warn: 100,  crit: 120  },
      engine_rpm:       { warn: 1800, crit: 2000 },
      oil_temp:         { warn: 100,  crit: 115  },
      coolant_temp:     { warn: 95,   crit: 105  },
      fuel_level:       { warnLow: 20, critLow: 10 },
      fuel_consumption: { warn: 200,  crit: 260  },
      brake_pressure:   { warnLow: 350, critLow: 300 },
      main_pressure:    { warnLow: 600, critLow: 500 },
      traction_current: { warn: 800,  crit: 1000 },
      voltage:          { warnLow: 48, critLow: 44 },
      signal_quality:   { warnLow: 60, critLow: 30 },
      fault_count:      { warn: 1,    crit: 3    },
    },
    /** thermal = силовая установка (масло, ОЖ, ДВС) — тот же ключ подсистемы, что и в движке HK-004 */
    healthWeights: {
      thermal:    0.35,
      traction:   0.25,
      brakes:     0.20,
      electrical: 0.12,
      signaling:  0.08,
    },
    recommendations: {
      oil_temp_crit:       "Немедленно снизить нагрузку, проверить систему смазки дизеля",
      coolant_temp_crit:   "Проверить уровень и циркуляцию охлаждающей жидкости",
      fuel_level_crit:     "Срочно пополнить запас топлива",
      brake_pressure_crit: "Остановить локомотив, проверить тормозную магистраль",
      signal_quality_crit: "Проверить канал связи и GPS/ГЛОНАСС антенну",
      fault_count_crit:    "Обратиться к журналу DTC, вызвать инженера",
      default:             "Продолжать наблюдение, снизить нагрузку",
    },
  },
};

function getProfile(locomotiveType) {
  return PROFILES[locomotiveType] || null;
}

function getAllProfiles() {
  return Object.values(PROFILES).map(({ id, name, type, description, subsystems }) => ({
    id, name, type, description, subsystems,
  }));
}

module.exports = { PROFILES, getProfile, getAllProfiles };
