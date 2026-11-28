(function (global) {
  'use strict';

  const STORAGE_KEY = 'STRUCTURA_PORTAL_STATE_V1';

  function getOffsetDateString(daysOffset = 0) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + daysOffset);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getTodayDateString() {
    return getOffsetDateString(0);
  }

  function generateId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  function createDefaultState() {
    return {
      referenceDate: getTodayDateString(),
      projects: [
        {
          id: 'proj-1',
          code: 'PRJ-101',
          name: 'Aethelgard Commercial Tower',
          client: 'Aethelgard Holdings Ltd.',
          location: 'Financial District, Plot 14',
          manager: 'Arjun Mehta, PE',
          budget: 14250000,
          startDate: getOffsetDateString(-95),
          endDate: getOffsetDateString(110),
          image: 'assets/images/project-skyline.png',
          description:
            '28-story composite steel and unitized curtain-wall commercial headquarters featuring deep-pile foundation and rooftop solar canopy.',
          phases: [
            {
              id: 'ph-1-1',
              name: '01. Excavation & Foundation',
              deadline: getOffsetDateString(-45),
              progress: 100,
              status: 'Completed',
              manualProgress: false
            },
            {
              id: 'ph-1-2',
              name: '02. Structural Framing & Core',
              deadline: getOffsetDateString(-3),
              progress: 48,
              status: 'Active',
              manualProgress: false
            },
            {
              id: 'ph-1-3',
              name: '03. MEP & Vertical Transport',
              deadline: getOffsetDateString(42),
              progress: 23,
              status: 'Active',
              manualProgress: false
            },
            {
              id: 'ph-1-4',
              name: '04. Facade & Interior Finishing',
              deadline: getOffsetDateString(105),
              progress: 0,
              status: 'Pending',
              manualProgress: false
            }
          ]
        },
        {
          id: 'proj-2',
          code: 'PRJ-102',
          name: 'Metro Line-4 Elevated Viaduct',
          client: 'Metropolitan Transit Authority',
          location: 'East Corridor, Piers P12–P28',
          manager: 'Priya Nair, PMP',
          budget: 22800000,
          startDate: getOffsetDateString(-120),
          endDate: getOffsetDateString(88),
          image: 'assets/images/project-metro.png',
          description:
            '4.2 km precast segmental box-girder transit viaduct with seismic pier caps, elastomeric bearings, and elevated concourse deck.',
          phases: [
            {
              id: 'ph-2-1',
              name: '01. Deep Piling & Substructure',
              deadline: getOffsetDateString(-62),
              progress: 100,
              status: 'Completed',
              manualProgress: false
            },
            {
              id: 'ph-2-2',
              name: '02. Pier Caps & Girder Erection',
              deadline: getOffsetDateString(16),
              progress: 48,
              status: 'Active',
              manualProgress: false
            },
            {
              id: 'ph-2-3',
              name: '03. Track Slab & Electrification',
              deadline: getOffsetDateString(58),
              progress: 0,
              status: 'Pending',
              manualProgress: false
            },
            {
              id: 'ph-2-4',
              name: '04. Load Testing & Handover',
              deadline: getOffsetDateString(86),
              progress: 0,
              status: 'Pending',
              manualProgress: false
            }
          ]
        },
        {
          id: 'proj-3',
          code: 'PRJ-103',
          name: 'Verde Courtyard Residences',
          client: 'Verde Urban Living',
          location: 'Greenway Boulevard, Sector 7',
          manager: 'Elena Rostova',
          budget: 8400000,
          startDate: getOffsetDateString(-145),
          endDate: getOffsetDateString(-4),
          image: 'assets/images/project-residences.png',
          description:
            '64-unit low-carbon cross-laminated timber and architectural exposed concrete residential enclave with rain-garden courtyard.',
          phases: [
            {
              id: 'ph-3-1',
              name: '01. Site Grading & Raft Foundation',
              deadline: getOffsetDateString(-105),
              progress: 100,
              status: 'Completed',
              manualProgress: false
            },
            {
              id: 'ph-3-2',
              name: '02. Timber & Concrete Superstructure',
              deadline: getOffsetDateString(-68),
              progress: 100,
              status: 'Completed',
              manualProgress: false
            },
            {
              id: 'ph-3-3',
              name: '03. Smart MEP & Solar Microgrid',
              deadline: getOffsetDateString(-32),
              progress: 100,
              status: 'Completed',
              manualProgress: false
            },
            {
              id: 'ph-3-4',
              name: '04. Architectural Finishes & QA',
              deadline: getOffsetDateString(-5),
              progress: 100,
              status: 'Completed',
              manualProgress: false
            }
          ]
        },
        {
          id: 'proj-4',
          code: 'PRJ-104',
          name: 'Titan Cold-Chain Logistics Park',
          client: 'Titan Freight Infrastructure',
          location: 'Industrial Ring Road, Zone C',
          manager: 'Vikram Rathore',
          budget: 11600000,
          startDate: getOffsetDateString(-48),
          endDate: getOffsetDateString(74),
          image: 'assets/images/project-logistics.png',
          description:
            '185,000 sq.ft high-bay precast concrete logistics warehouse with clear-span steel roof trusses and automated dock levelers.',
          phases: [
            {
              id: 'ph-4-1',
              name: '01. Sub-base & Laser-Screed Slab',
              deadline: getOffsetDateString(-12),
              progress: 100,
              status: 'Completed',
              manualProgress: false
            },
            {
              id: 'ph-4-2',
              name: '02. Precast Wall & Roof Truss Erection',
              deadline: getOffsetDateString(14),
              progress: 73,
              status: 'Active',
              manualProgress: false
            },
            {
              id: 'ph-4-3',
              name: '03. Refrigeration & Fire Suppression',
              deadline: getOffsetDateString(44),
              progress: 0,
              status: 'Pending',
              manualProgress: false
            },
            {
              id: 'ph-4-4',
              name: '04. Dock Doors & Yard Paving',
              deadline: getOffsetDateString(72),
              progress: 0,
              status: 'Pending',
              manualProgress: false
            }
          ]
        }
      ],

      workers: [
        {
          id: 'wrk-1',
          code: 'CRW-01',
          teamName: 'Apex Foundation & Piling Crew',
          leadName: 'Rajesh Kulkarni',
          trade: 'Concrete & Formwork',
          headcount: 18,
          phone: '+91 98201 44120',
          certId: 'OSHA-CF-409',
          primaryProjectId: 'proj-1',
          status: 'On Site',
          dailyRate: 1450
        },
        {
          id: 'wrk-2',
          code: 'CRW-02',
          teamName: 'Ironworks Core Formwork Squad',
          leadName: 'Marcus Vance',
          trade: 'Concrete & Formwork',
          headcount: 22,
          phone: '+91 98201 77315',
          certId: 'ACI-FRM-882',
          primaryProjectId: 'proj-1',
          status: 'On Site',
          dailyRate: 1820
        },
        {
          id: 'wrk-3',
          code: 'CRW-03',
          teamName: 'Skyline High-Rise Steel Riggers',
          leadName: 'Karanveer Gill',
          trade: 'Structural Steel',
          headcount: 16,
          phone: '+91 98114 55092',
          certId: 'AISC-STR-310',
          primaryProjectId: 'proj-1',
          status: 'On Site',
          dailyRate: 2100
        },
        {
          id: 'wrk-4',
          code: 'CRW-04',
          teamName: 'VoltFlow MEP & HVAC Unit',
          leadName: 'Sana Siddiqui',
          trade: 'MEP Systems',
          headcount: 14,
          phone: '+91 97650 32118',
          certId: 'NFPA-MEP-519',
          primaryProjectId: 'proj-1',
          status: 'Assigned',
          dailyRate: 1650
        },
        {
          id: 'wrk-5',
          code: 'CRW-05',
          teamName: 'BridgeSpan Post-Tension Team',
          leadName: 'Daniel Okafor',
          trade: 'Post-Tension & Civil',
          headcount: 20,
          phone: '+91 99002 18440',
          certId: 'PTI-GRT-704',
          primaryProjectId: 'proj-2',
          status: 'On Site',
          dailyRate: 2250
        },
        {
          id: 'wrk-6',
          code: 'CRW-06',
          teamName: 'Titan Heavy Crane & Launching Rig',
          leadName: 'Harpreet Singh',
          trade: 'Heavy Rigging & Crane',
          headcount: 10,
          phone: '+91 98450 61299',
          certId: 'NCCCO-912',
          primaryProjectId: 'proj-2',
          status: 'On Site',
          dailyRate: 1950
        },
        {
          id: 'wrk-7',
          code: 'CRW-07',
          teamName: 'Atelier Facade & Finish Artisans',
          leadName: 'Meera Deshmukh',
          trade: 'Interior Finishing',
          headcount: 15,
          phone: '+91 98223 90411',
          certId: 'LEED-FIN-208',
          primaryProjectId: 'proj-3',
          status: 'Standby',
          dailyRate: 1500
        },
        {
          id: 'wrk-8',
          code: 'CRW-08',
          teamName: 'Precision Precast & Truss Erectors',
          leadName: 'Rohan Chatterjee',
          trade: 'Structural Steel',
          headcount: 19,
          phone: '+91 98310 66341',
          certId: 'PCI-PRC-640',
          primaryProjectId: 'proj-4',
          status: 'On Site',
          dailyRate: 1880
        }
      ],

      tasks: [

        {
          id: 'tsk-101',
          code: 'TSK-101',
          projectId: 'proj-1',
          phaseId: 'ph-1-1',
          workerId: 'wrk-1',
          title: 'Secant Pile Cap Waterproofing & Mat Pour',
          description: 'Complete bentonite membrane sealing and continuous 950 m³ raft pour.',
          priority: 'High',
          status: 'Completed',
          deadline: getOffsetDateString(-46),
          estimatedHours: 64
        },
        {
          id: 'tsk-102',
          code: 'TSK-102',
          projectId: 'proj-1',
          phaseId: 'ph-1-2',
          workerId: 'wrk-3',
          title: 'Levels 1–16 Structural Steel Column Erection',
          description: 'Plumb, weld, and ultrasonic-test primary wide-flange columns through podium and lower tower.',
          priority: 'High',
          status: 'Completed',
          deadline: getOffsetDateString(-14),
          estimatedHours: 120
        },
        {
          id: 'tsk-103',
          code: 'TSK-103',
          projectId: 'proj-1',
          phaseId: 'ph-1-2',
          workerId: 'wrk-2',
          title: 'Level 18–22 Core Shear Wall Concrete Pour',
          description: 'Jump-form concrete placement for central elevator core shear walls.',
          priority: 'Critical',
          status: 'In Progress',
          deadline: getOffsetDateString(-4),
          estimatedHours: 72
        },
        {
          id: 'tsk-104',
          code: 'TSK-104',
          projectId: 'proj-1',
          phaseId: 'ph-1-2',
          workerId: 'wrk-3',
          title: 'East Wing Composite Steel Deck Bolting & Torque QA',
          description: 'Install metal decking shear studs and verify high-strength bolt tension.',
          priority: 'High',
          status: 'Pending',
          deadline: getOffsetDateString(-2),
          estimatedHours: 48
        },
        {
          id: 'tsk-105',
          code: 'TSK-105',
          projectId: 'proj-1',
          phaseId: 'ph-1-3',
          workerId: 'wrk-4',
          title: 'Basement Chiller Plant & Main Riser Trunking',
          description: 'Rough-in primary chilled water headers and electrical busbars.',
          priority: 'Medium',
          status: 'In Progress',
          deadline: getOffsetDateString(9),
          estimatedHours: 80
        },
        {
          id: 'tsk-106',
          code: 'TSK-106',
          projectId: 'proj-1',
          phaseId: 'ph-1-3',
          workerId: 'wrk-4',
          title: 'High-Speed Elevator Shaft Rail Alignment',
          description: 'Laser-plumb guide rails for passenger banks A & B.',
          priority: 'Medium',
          status: 'Pending',
          deadline: getOffsetDateString(24),
          estimatedHours: 56
        },
        {
          id: 'tsk-107',
          code: 'TSK-107',
          projectId: 'proj-1',
          phaseId: 'ph-1-4',
          workerId: 'wrk-7',
          title: 'Unitized Double-Glazed Curtain Wall Mockup Approval',
          description: 'Conduct water penetration and wind-load facade mockup test.',
          priority: 'Low',
          status: 'Pending',
          deadline: getOffsetDateString(52),
          estimatedHours: 36
        },

        {
          id: 'tsk-201',
          code: 'TSK-201',
          projectId: 'proj-2',
          phaseId: 'ph-2-1',
          workerId: 'wrk-5',
          title: 'Bored Cast-in-Situ Pile Load Testing (P12–P28)',
          description: 'Static vertical and lateral pile integrity tests passed by MTA engineer.',
          priority: 'High',
          status: 'Completed',
          deadline: getOffsetDateString(-64),
          estimatedHours: 90
        },
        {
          id: 'tsk-202',
          code: 'TSK-202',
          projectId: 'proj-2',
          phaseId: 'ph-2-2',
          workerId: 'wrk-6',
          title: 'Segmental Box Girder Launching Span P12–P18',
          description: 'Overhead launching gantry placement of 72 precast box segments.',
          priority: 'High',
          status: 'Completed',
          deadline: getOffsetDateString(-10),
          estimatedHours: 140
        },
        {
          id: 'tsk-203',
          code: 'TSK-203',
          projectId: 'proj-2',
          phaseId: 'ph-2-2',
          workerId: 'wrk-5',
          title: 'Pier P19–P22 Post-Tensioning Tendon Grouting',
          description: 'Stress longitudinal tendons to 75% UTS and inject non-shrink cementitious grout.',
          priority: 'Critical',
          status: 'In Progress',
          deadline: getOffsetDateString(-6),
          estimatedHours: 60
        },
        {
          id: 'tsk-204',
          code: 'TSK-204',
          projectId: 'proj-2',
          phaseId: 'ph-2-2',
          workerId: 'wrk-6',
          title: 'Pier P24 Elastomeric Bearing Pad Seat Leveling',
          description: 'Epoxy grout leveling of pedestal seats prior to girder drop.',
          priority: 'High',
          status: 'Pending',
          deadline: getOffsetDateString(-1),
          estimatedHours: 32
        },
        {
          id: 'tsk-205',
          code: 'TSK-205',
          projectId: 'proj-2',
          phaseId: 'ph-2-3',
          workerId: 'wrk-4',
          title: '25kV Overhead Catenary Mast Anchor Installation',
          description: 'Install stainless anchor pockets along viaduct parapet curb.',
          priority: 'Medium',
          status: 'Pending',
          deadline: getOffsetDateString(34),
          estimatedHours: 48
        },

        {
          id: 'tsk-301',
          code: 'TSK-301',
          projectId: 'proj-3',
          phaseId: 'ph-3-1',
          workerId: 'wrk-1',
          title: 'Excavation & Insulated Concrete Raft Foundation',
          description: 'Completed perimeter retaining wall and insulated slab-on-grade.',
          priority: 'High',
          status: 'Completed',
          deadline: getOffsetDateString(-106),
          estimatedHours: 70
        },
        {
          id: 'tsk-302',
          code: 'TSK-302',
          projectId: 'proj-3',
          phaseId: 'ph-3-2',
          workerId: 'wrk-8',
          title: 'Cross-Laminated Timber Floor & Shear Panel Assembly',
          description: 'Erected 5 stories of CNC-milled CLT panels with acoustic dampeners.',
          priority: 'High',
          status: 'Completed',
          deadline: getOffsetDateString(-70),
          estimatedHours: 110
        },
        {
          id: 'tsk-303',
          code: 'TSK-303',
          projectId: 'proj-3',
          phaseId: 'ph-3-3',
          workerId: 'wrk-4',
          title: 'Heat-Pump HVAC & Rooftop Solar Inverter Commissioning',
          description: 'Balanced domestic hot-water loops and net-metered solar array.',
          priority: 'Medium',
          status: 'Completed',
          deadline: getOffsetDateString(-33),
          estimatedHours: 55
        },
        {
          id: 'tsk-304',
          code: 'TSK-304',
          projectId: 'proj-3',
          phaseId: 'ph-3-4',
          workerId: 'wrk-7',
          title: 'Final Snag Clearance & Municipal Occupancy Sign-off',
          description: 'Zero-defect walkthrough completed with Verde Urban Living reps.',
          priority: 'High',
          status: 'Completed',
          deadline: getOffsetDateString(-6),
          estimatedHours: 40
        },

        {
          id: 'tsk-401',
          code: 'TSK-401',
          projectId: 'proj-4',
          phaseId: 'ph-4-1',
          workerId: 'wrk-1',
          title: 'Super-Flat FM2 Laser-Screed Warehouse Floor Slab',
          description: 'Fiber-reinforced slab poured and cured to Fmin 60 flatness tolerance.',
          priority: 'High',
          status: 'Completed',
          deadline: getOffsetDateString(-14),
          estimatedHours: 88
        },
        {
          id: 'tsk-402',
          code: 'TSK-402',
          projectId: 'proj-4',
          phaseId: 'ph-4-2',
          workerId: 'wrk-8',
          title: 'Precast Insulated Perimeter Wall Panels (Bays 1–12)',
          description: 'Crane-lift and brace 14m tall tilt-up insulated wall panels.',
          priority: 'High',
          status: 'Completed',
          deadline: getOffsetDateString(-2),
          estimatedHours: 76
        },
        {
          id: 'tsk-403',
          code: 'TSK-403',
          projectId: 'proj-4',
          phaseId: 'ph-4-2',
          workerId: 'wrk-8',
          title: '36m Clear-Span Roof Truss & Purlin Bracing',
          description: 'Bolt primary lattice roof trusses across bays 6–12.',
          priority: 'High',
          status: 'In Progress',
          deadline: getOffsetDateString(6),
          estimatedHours: 64
        },
        {
          id: 'tsk-404',
          code: 'TSK-404',
          projectId: 'proj-4',
          phaseId: 'ph-4-3',
          workerId: 'wrk-4',
          title: 'Ammonia Rack & ESFR Early-Suppression Sprinkler Mains',
          description: 'Install overhead cold-storage refrigeration headers and fire risers.',
          priority: 'Medium',
          status: 'Pending',
          deadline: getOffsetDateString(28),
          estimatedHours: 92
        }
      ],

      materials: [
        {
          id: 'mat-1',
          code: 'MAT-01',
          projectId: 'proj-1',
          phaseId: 'ph-1-1',
          name: 'M50 Sulfate-Resistant Ready-Mix Concrete',
          category: 'Concrete & Cement',
          unit: 'm³',
          requiredQty: 1400,
          deliveredQty: 1400,
          consumedQty: 1400,
          unitCost: 135,
          supplier: 'UltraCrete RMC Solutions',
          deliveryDeadline: getOffsetDateString(-50)
        },
        {
          id: 'mat-2',
          code: 'MAT-02',
          projectId: 'proj-1',
          phaseId: 'ph-1-2',
          name: 'Fe-550D High-Tensile Rebar Steel',
          category: 'Structural Steel',
          unit: 'Tons',
          requiredQty: 420,
          deliveredQty: 310,
          consumedQty: 295,
          unitCost: 890,
          supplier: 'Apex Metallurgy Corp.',
          deliveryDeadline: getOffsetDateString(-3)
        },
        {
          id: 'mat-3',
          code: 'MAT-03',
          projectId: 'proj-1',
          phaseId: 'ph-1-2',
          name: 'ASTM A992 Wide-Flange H-Beams',
          category: 'Structural Steel',
          unit: 'Tons',
          requiredQty: 680,
          deliveredQty: 540,
          consumedQty: 410,
          unitCost: 1240,
          supplier: 'Arcelor Structural Fab',
          deliveryDeadline: getOffsetDateString(8)
        },
        {
          id: 'mat-4',
          code: 'MAT-04',
          projectId: 'proj-1',
          phaseId: 'ph-1-3',
          name: 'Copper Armored Power Busbar & Tray',
          category: 'MEP & Conduit',
          unit: 'Meters',
          requiredQty: 2600,
          deliveredQty: 1100,
          consumedQty: 420,
          unitCost: 78,
          supplier: 'Schneider Industrial Supply',
          deliveryDeadline: getOffsetDateString(19)
        },
        {
          id: 'mat-5',
          code: 'MAT-05',
          projectId: 'proj-2',
          phaseId: 'ph-2-2',
          name: 'Precast Segmental Box Girder Units (3.2m)',
          category: 'Precast & Timber',
          unit: 'Units',
          requiredQty: 140,
          deliveredQty: 96,
          consumedQty: 88,
          unitCost: 18500,
          supplier: 'MetroCast Yard #2',
          deliveryDeadline: getOffsetDateString(-2)
        },
        {
          id: 'mat-6',
          code: 'MAT-06',
          projectId: 'proj-2',
          phaseId: 'ph-2-2',
          name: 'Low-Relaxation 7-Wire PT Strands (15.2mm)',
          category: 'Structural Steel',
          unit: 'Tons',
          requiredQty: 95,
          deliveredQty: 95,
          consumedQty: 64,
          unitCost: 1420,
          supplier: 'TensorWire Systems',
          deliveryDeadline: getOffsetDateString(-8)
        },
        {
          id: 'mat-7',
          code: 'MAT-07',
          projectId: 'proj-3',
          phaseId: 'ph-3-2',
          name: '5-Ply Cross-Laminated Timber Panels',
          category: 'Precast & Timber',
          unit: 'm³',
          requiredQty: 520,
          deliveredQty: 520,
          consumedQty: 520,
          unitCost: 960,
          supplier: 'NordicTimber Engineering',
          deliveryDeadline: getOffsetDateString(-75)
        },
        {
          id: 'mat-8',
          code: 'MAT-08',
          projectId: 'proj-3',
          phaseId: 'ph-3-4',
          name: 'Low-VOC Acoustic Timber Flooring',
          category: 'Finishing',
          unit: 'Pallets',
          requiredQty: 85,
          deliveredQty: 85,
          consumedQty: 85,
          unitCost: 620,
          supplier: 'EcoSurface Architectural',
          deliveryDeadline: getOffsetDateString(-18)
        },
        {
          id: 'mat-9',
          code: 'MAT-09',
          projectId: 'proj-4',
          phaseId: 'ph-4-2',
          name: 'Insulated Precast Tilt-Up Wall Panels',
          category: 'Precast & Timber',
          unit: 'Units',
          requiredQty: 96,
          deliveredQty: 80,
          consumedQty: 68,
          unitCost: 4200,
          supplier: 'Titan Precast Works',
          deliveryDeadline: getOffsetDateString(7)
        },
        {
          id: 'mat-10',
          code: 'MAT-10',
          projectId: 'proj-4',
          phaseId: 'ph-4-2',
          name: 'Galvanized Cold-Formed Z-Purlins & Gussets',
          category: 'Structural Steel',
          unit: 'Tons',
          requiredQty: 145,
          deliveredQty: 145,
          consumedQty: 92,
          unitCost: 1080,
          supplier: 'Vanguard Steel Trusses',
          deliveryDeadline: getOffsetDateString(-4)
        }
      ]
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const initial = createDefaultState();
        saveState(initial);
        return initial;
      }
      const parsed = JSON.parse(raw);
      if (
        !parsed ||
        !Array.isArray(parsed.projects) ||
        !Array.isArray(parsed.tasks) ||
        !Array.isArray(parsed.workers) ||
        !Array.isArray(parsed.materials)
      ) {
        throw new Error('Invalid saved state structure');
      }
      if (!parsed.referenceDate) {
        parsed.referenceDate = getTodayDateString();
      }
      return parsed;
    } catch (err) {
      console.warn('Resetting Structura data due to load error:', err);
      const fallback = createDefaultState();
      saveState(fallback);
      return fallback;
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Failed to persist state to localStorage:', err);
    }
  }

  function resetState() {
    const fresh = createDefaultState();
    saveState(fresh);
    return fresh;
  }

  global.StructuraData = {
    STORAGE_KEY,
    getTodayDateString,
    getOffsetDateString,
    generateId,
    createDefaultState,
    loadState,
    saveState,
    resetState
  };
})(window);
