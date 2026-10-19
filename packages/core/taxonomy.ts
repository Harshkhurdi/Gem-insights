export const taxonomy: Record<string, Array<[string, string, string[]]>> = {
  "Critical Care": [
    [
      "icu-ventilators",
      "ICU ventilators",
      [
        "icu ventilator",
        "icu ventilators",
        "high end icu ventilator",
        "high end ventilator",
      ],
    ],
    [
      "transport-ventilators",
      "Transport ventilators",
      ["transport ventilator", "portable ventilator"],
    ],
    [
      "patient-monitors",
      "Patient monitors",
      [
        "patient monitor",
        "patient monitors",
        "multiparameter monitor",
        "multi parameter monitor",
        "multipara monitor",
        "bedside patient monitoring system",
        "high end multipara monitor",
      ],
    ],
    ["defibrillators", "Defibrillators", ["defibrillator", "defibrillators"]],
    ["infusion-pumps", "Infusion pumps", ["infusion pump", "infusion pumps"]],
    ["syringe-pumps", "Syringe pumps", ["syringe pump", "syringe pumps"]],
    [
      "oxygen-concentrators",
      "Oxygen concentrators",
      ["oxygen concentrator", "oxygen concentrators"],
    ],
  ],
  "Diagnostic Imaging": [
    [
      "ultrasound",
      "Ultrasound systems",
      ["ultrasound", "ultrasonography", "sonography system"],
    ],
    [
      "x-ray",
      "X-ray systems",
      ["x ray machine", "x ray system", "mobile x ray"],
    ],
    ["c-arm", "C-arm systems", ["c arm"]],
    ["ct", "CT scanners", ["ct scanner", "ct scan machine"]],
    [
      "mri",
      "MRI systems",
      ["mri machine", "mri system", "magnetic resonance imaging system"],
    ],
    ["mammography", "Mammography systems", ["mammography"]],
  ],
  "Operation Theatre": [
    [
      "anaesthesia",
      "Anaesthesia workstations",
      [
        "anaesthesia machine",
        "anesthesia machine",
        "anaesthesia workstation",
        "anesthesia workstation",
      ],
    ],
    [
      "ot-tables",
      "OT tables",
      ["ot table", "operation theatre table", "operating table"],
    ],
    ["surgical-lights", "Surgical lights", ["surgical light", "ot light"]],
    [
      "electrosurgery",
      "Electrosurgical units",
      ["electrosurgical unit", "electrosurgery"],
    ],
    ["endoscopy", "Endoscopy systems", ["endoscopy system", "endoscope"]],
    [
      "laparoscopy",
      "Laparoscopy systems",
      ["laparoscopy system", "laparoscopic surgery system"],
    ],
  ],
  "Hospital Infrastructure": [
    ["icu-beds", "ICU beds", ["icu bed"]],
    [
      "electric-beds",
      "Electric hospital beds",
      ["electric hospital bed", "motorized hospital bed"],
    ],
    ["manual-beds", "Manual hospital beds", ["manual hospital bed"]],
    ["stretchers", "Patient stretchers", ["stretcher"]],
    ["examination-tables", "Examination tables", ["examination table"]],
  ],
  "Laboratory Equipment": [
    [
      "hematology",
      "Hematology analyzers",
      ["hematology analyzer", "haematology analyser", "hematology analyser"],
    ],
    [
      "biochemistry",
      "Biochemistry analyzers",
      ["biochemistry analyzer", "biochemistry analyser"],
    ],
    [
      "blood-gas",
      "Blood gas analyzers",
      ["blood gas analyzer", "blood gas analyser"],
    ],
    ["microscopes", "Microscopes", ["microscope"]],
    ["centrifuges", "Centrifuges", ["centrifuge"]],
    [
      "lab-refrigerators",
      "Laboratory refrigerators",
      ["laboratory refrigerator", "lab refrigerator"],
    ],
  ],
  Sterilization: [
    ["autoclaves", "Autoclaves", ["autoclave"]],
    ["sterilizers", "Sterilizers", ["sterilizer", "steriliser"]],
    ["washer-disinfectors", "Washer disinfectors", ["washer disinfector"]],
  ],
};
export const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-");
