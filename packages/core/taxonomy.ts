export const taxonomy: Record<string, Array<[string, string, string[]]>> = {
  "Critical Care": [
    [
      "ventilators-other",
      "Ventilators (type unspecified)",
      ["ventilator", "ventilators"],
    ],
    ["bipap-cpap", "BiPAP and CPAP systems", ["bipap", "cpap"]],
    [
      "hfnc",
      "High flow nasal oxygen systems",
      ["hfnc", "high flow nasal cannula", "high flow oxygen therapy"],
    ],
    [
      "suction-machines",
      "Suction machines",
      ["suction machine", "suction apparatus"],
    ],
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
      "cbct",
      "Cone beam CT systems",
      ["cone beam computed tomography", "cone beam ct", "cbct"],
    ],
    [
      "fluoroscopy",
      "Fluoroscopy systems",
      ["fluoroscopy system", "fluoroscopy machine"],
    ],
    ["pet-ct", "PET CT systems", ["pet ct", "positron emission tomography"]],
    [
      "bone-densitometry",
      "Bone densitometers",
      ["bone densitometer", "dexa scanner", "dxa scanner"],
    ],
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
      "urine-analyzers",
      "Urine analyzers",
      [
        "urine analyzer",
        "urine analyser",
        "urine chemistry and sediment analyzer",
      ],
    ],
    [
      "coagulation",
      "Coagulation analyzers",
      ["coagulation analyzer", "coagulation analyser", "coagulometer"],
    ],
    [
      "immunoassay",
      "Immunoassay analyzers",
      [
        "immunoassay analyzer",
        "immunoassay analyser",
        "chemiluminescence analyzer",
      ],
    ],
    [
      "pcr",
      "PCR and real time PCR systems",
      ["pcr machine", "real time pcr", "thermal cycler", "thermocycler"],
    ],
    [
      "flow-cytometry",
      "Flow cytometers",
      ["flow cytometer", "flow cytometry system"],
    ],
    [
      "elisa",
      "ELISA readers and washers",
      ["elisa reader", "elisa washer", "microplate reader"],
    ],
    ["spectrophotometers", "Spectrophotometers", ["spectrophotometer"]],
    [
      "lab-incubators",
      "Laboratory incubators",
      ["co2 incubator", "laboratory incubator", "bacteriological incubator"],
    ],
    [
      "biosafety-cabinets",
      "Biosafety cabinets",
      [
        "biosafety cabinet",
        "biological safety cabinet",
        "laminar airflow",
        "laminar air flow",
      ],
    ],
    [
      "deep-freezers",
      "Deep freezers",
      ["deep freezer", "ultra low temperature freezer"],
    ],
    [
      "blood-bank-refrigerators",
      "Blood bank refrigerators",
      ["blood bank refrigerator"],
    ],
    [
      "histopathology",
      "Histopathology processing equipment",
      ["microtome", "tissue processor", "cryostat"],
    ],
    [
      "hplc",
      "Chromatography systems",
      ["hplc system", "liquid chromatography", "gas chromatograph"],
    ],
    [
      "mass-spectrometry",
      "Mass spectrometers",
      ["mass spectrometer", "mass spectrometry system"],
    ],
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
  Cardiology: [
    [
      "ecg",
      "ECG machines",
      ["ecg machine", "electrocardiograph", "electrocardiogram machine"],
    ],
    [
      "echo",
      "Echocardiography systems",
      ["echocardiography system", "echocardiography machine"],
    ],
    [
      "cath-lab",
      "Cardiac catheterization systems",
      ["cath lab", "cardiac catheterization system"],
    ],
    ["holter", "Holter monitors", ["holter monitor"]],
    [
      "tmt",
      "Treadmill stress test systems",
      ["treadmill test system", "tmt machine"],
    ],
    ["cardiac-output", "Cardiac output monitors", ["cardiac output monitor"]],
  ],
  "Renal Care": [
    [
      "dialysis",
      "Hemodialysis machines",
      ["hemodialysis machine", "haemodialysis machine", "dialysis machine"],
    ],
    [
      "crrt",
      "CRRT systems",
      ["crrt machine", "crrt system", "continuous renal replacement therapy"],
    ],
    [
      "dialysis-ro",
      "Dialysis water treatment systems",
      ["ro plant for dialysis", "dialysis ro plant"],
    ],
  ],
  "Maternal and Neonatal Care": [
    [
      "neonatal-incubators",
      "Neonatal incubators",
      ["neonatal incubator", "infant incubator"],
    ],
    [
      "radiant-warmers",
      "Infant radiant warmers",
      ["radiant warmer", "infant warmer"],
    ],
    [
      "phototherapy",
      "Neonatal phototherapy units",
      ["phototherapy unit", "phototherapy machine"],
    ],
    [
      "fetal-monitors",
      "Fetal monitors",
      ["fetal monitor", "foetal monitor", "cardiotocograph", "ctg machine"],
    ],
    ["delivery-tables", "Delivery tables", ["delivery table", "labour table"]],
  ],
  Ophthalmology: [
    ["slit-lamps", "Slit lamps", ["slit lamp"]],
    [
      "ophthalmic-microscopes",
      "Ophthalmic operating microscopes",
      ["ophthalmic operating microscope"],
    ],
    [
      "phaco",
      "Phacoemulsification systems",
      ["phacoemulsification", "phaco machine"],
    ],
    [
      "oct",
      "Optical coherence tomography systems",
      ["optical coherence tomography", "oct machine"],
    ],
    ["fundus-cameras", "Fundus cameras", ["fundus camera"]],
    ["tonometers", "Tonometers", ["tonometer"]],
    [
      "autorefractors",
      "Autorefractors",
      ["autorefractor", "auto refractometer"],
    ],
    [
      "ophthalmic-lasers",
      "Ophthalmic lasers",
      ["yag laser", "retinal laser", "excimer laser"],
    ],
  ],
  "Dental Equipment": [
    [
      "dental-chairs",
      "Dental chairs and units",
      ["dental chair", "dental unit"],
    ],
    [
      "dental-imaging",
      "Dental imaging systems",
      ["orthopantomogram", "opg machine", "dental x ray", "dental cbct"],
    ],
    ["dental-scanners", "Intraoral scanners", ["intraoral scanner"]],
  ],
  "ENT and Audiology": [
    ["audiometers", "Audiometers", ["audiometer"]],
    ["tympanometers", "Tympanometers", ["tympanometer"]],
    [
      "ent-workstations",
      "ENT workstations",
      ["ent workstation", "ent treatment unit"],
    ],
    [
      "otoacoustic",
      "Otoacoustic emission systems",
      ["otoacoustic emission", "oae screening"],
    ],
  ],
  Neurology: [
    ["eeg", "EEG machines", ["eeg machine", "electroencephalograph"]],
    [
      "emg",
      "EMG and nerve conduction systems",
      ["emg machine", "electromyograph", "nerve conduction system"],
    ],
    [
      "neuro-navigation",
      "Neurosurgical navigation systems",
      ["neuronavigation", "neuro navigation system"],
    ],
  ],
  Oncology: [
    [
      "linac",
      "Medical linear accelerators",
      [
        "medical linear accelerator",
        "linear accelerator for radiotherapy",
        "linac",
      ],
    ],
    [
      "brachytherapy",
      "Brachytherapy systems",
      ["brachytherapy system", "brachytherapy machine"],
    ],
    [
      "radiotherapy-simulator",
      "Radiotherapy simulators",
      ["radiotherapy simulator"],
    ],
  ],
  "Physiotherapy and Rehabilitation": [
    [
      "physio-ultrasound",
      "Therapeutic ultrasound equipment",
      ["therapeutic ultrasound", "ultrasound therapy"],
    ],
    [
      "electrotherapy",
      "Electrotherapy systems",
      ["interferential therapy", "tens machine", "shortwave diathermy"],
    ],
    [
      "rehabilitation",
      "Rehabilitation training equipment",
      ["gait trainer", "continuous passive motion machine"],
    ],
  ],
  "Respiratory Diagnostics": [
    ["spirometers", "Spirometers", ["spirometer"]],
    [
      "pulmonary-function",
      "Pulmonary function test systems",
      ["pulmonary function test", "pft machine"],
    ],
    [
      "sleep-diagnostics",
      "Sleep diagnostic systems",
      ["polysomnography", "sleep study system"],
    ],
  ],
  "Surgical Specialties": [
    [
      "arthroscopy",
      "Arthroscopy systems",
      ["arthroscopy system", "arthroscopic system"],
    ],
    [
      "surgical-microscopes",
      "Surgical microscopes",
      ["surgical microscope", "operating microscope"],
    ],
    [
      "surgical-robots",
      "Robotic surgery systems",
      ["robotic surgery system", "surgical robot"],
    ],
    ["urology-lasers", "Urology lasers", ["holmium laser", "thulium laser"]],
    ["lithotripters", "Lithotripters", ["lithotripter", "lithotripsy machine"]],
    [
      "bronchoscopy",
      "Bronchoscopy systems",
      ["bronchoscope", "bronchoscopy system"],
    ],
    [
      "hysteroscopy",
      "Hysteroscopy systems",
      ["hysteroscope", "hysteroscopy system"],
    ],
    ["vessel-sealing", "Vessel sealing systems", ["vessel sealing system"]],
    [
      "heart-lung",
      "Heart lung machines",
      ["heart lung machine", "cardiopulmonary bypass machine"],
    ],
    [
      "ecmo",
      "ECMO systems",
      ["ecmo machine", "ecmo system", "extracorporeal membrane oxygenation"],
    ],
  ],
};
export const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-");
