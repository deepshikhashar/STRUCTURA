# STRUCTURA — Construction Project Management Portal

A clean, modular, zero-dependency **Construction Project Management Portal** built strictly with **Vanilla HTML5, Vanilla CSS3, and Vanilla ES6 JavaScript**.

Designed to run out-of-the-box by opening `index.html` directly in any browser (`file://`) or serving via any static HTTP server.

---

## Project Structure

```
constuction/
├── index.html                  # Semantic HTML5 app shell, 6 module views, and modal forms
├── css/
│   └── styles.css              # Self-contained responsive CSS3 design system
├── js/
│   ├── data.js                 # Initial dynamic dataset & localStorage persistence
│   └── app.js                  # Automated Delay Identification engine, DOM rendering & CRUD
├── assets/
│   └── images/                 # Architectural construction site imagery
│       ├── project-skyline.png
│       ├── project-metro.png
│       ├── project-residences.png
│       └── project-logistics.png
└── README.md                   # Documentation & evaluation demo walkthrough
```

---

## Coverage of All 9 Required Functional Features

1. **Project Creation (`Projects & Phases` / `+ New Project`)**: Create new construction projects with client, project manager, site location, estimated budget, timeline, cover imagery, and sequential phase templates.  
2. **Work Phases (`Project Inspector` \-\> `Manage Phases`)**: Every project is divided into sequential stages (e.g., *01\. Excavation & Foundation*, *02\. Structural Framing & Core*, *03\. MEP & Vertical Transport*, *04\. Facade & Interior Finishing*) with phase deadlines, live progress sliders, and task-synced progress.  
3. **Task Assignment (`Tasks & Deadlines` / `+ Assign Task`)**: Assign work items linked to a specific Project, Work Phase, and Worker Crew with priority and status (`Pending`, `In Progress`, `Completed`).  
4. **Deadlines & Reference Date Simulator**: Every task, work phase, and material requisition tracks a strict deadline. The top bar includes a **Ref Date** simulator so evaluators can test past or future dates live.  
5. **Worker / Team Records (`Workers & Teams`)**: Maintains crew records with foreman/lead name, trade specialty, crew headcount, safety certification ID, contact number, daily rate, deployment status (`On Site`, `Assigned`, `Standby`), and live count of active/delayed assigned tasks.  
6. **Material Requirements (`Materials & BOM`)**: Tracks materials per project and work phase with required vs. delivered vs. consumed quantities, unit costs, supplier, delivery deadline, batch receiving (`+ Receive`), and shortage tracking.  
7. **Progress Status**: Automatically calculates phase progress from assigned tasks (or manual override slider) and aggregates overall project completion percentages with color-coded progress bars.  
8. **Automated Delay Identification (`Delay Radar` & Live Badges)**:  
   - Automatically flags any incomplete task whose `deadline < referenceDate` as **DELAYED** with exact days overdue and severity (`Overdue` vs. `Critical`).  
   - Flags work phases if their own deadline slipped or if any child task is delayed.  
   - Flags material deliveries if `deliveredQty < requiredQty` after `deliveryDeadline`.  
9. **Project Dashboard (`Dashboard`)**: Summarizes **Total**, **Active**, **Completed**, and **Delayed** projects in KPI cards, shows an active delay alert banner, displays the **Project & Sequential Phase Progress Matrix**, and lists priority overdue items with 1-click resolution.

---

## Live Evaluation Demo Guide (2-Minute Walkthrough)

1. **Launch**: Open `index.html` in Chrome/Edge (or run `python -m http.server 8080` and visit `http://localhost:8080`).  
2. **Dashboard Overview**: Point out the **4 KPI cards** (`Total`, `Active`, `Completed`, `Delayed` projects), the red **Automated Delay Alert** banner, and the **Project & Sequential Phase Progress** bars.  
3. **Demonstrate Automated Delay Detection**:  
   - Open **Delay Radar** from the sidebar to show the overdue tasks, delayed phase, and late material deliveries.  
   - Change the **Ref Date** in the top bar by advancing it 15 days forward—show the evaluator how tasks from *Titan Cold-Chain Logistics Park* immediately flip to `DELAYED` across the Dashboard, Delay Radar, and Project Matrix\! Click **Today** to snap back.  
   - Click **Mark Completed** on an overdue task to watch the delay count drop and phase progress increase in real time.  
4. **Demonstrate CRUD Workflows**:  
   - Create a new project via **\+ New Project**.  
   - Click **Manage Phases** on any project to adjust phase completion sliders or add a new work phase.  
   - Assign a new task via **\+ Assign Task**, add a crew in **Workers & Teams**, and log a material batch in **Materials & BOM**.  
   - Refresh the page to prove everything persists automatically via `localStorage` (and use **Reset Demo Dataset** in the bottom-left sidebar whenever you want a fresh demo start).